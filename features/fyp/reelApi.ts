import { useFypGenderStore } from "@/features/fyp/genderStore"
import { qk } from "@/lib/shopify/queryKeys"
import { getNewestProductsPage, getProductByHandle } from "@/lib/shopify/services/products"
import { supabase } from "@/lib/supabase/client"
import { currentLocale } from "@/store/prefs"
import { useInfiniteQuery } from "@tanstack/react-query"

const REEL_PAGE_SIZE = 12
const REEL_TARGET_MIN_ITEMS = 10
const REEL_MATCH_FETCH_COUNT = 80
const REEL_SIMILARITY_START = 0.82
const REEL_SIMILARITY_FLOOR = 0
const REEL_SIMILARITY_STEP = 0.08
const REEL_MAX_ATTEMPTS = 12

type ReelPageParam = {
  seedHandle: string
  offset: number
  similarityMin: number
  fallbackCursor: string | null
  seenHandles: string[]
}

type ReelPage = {
  items: any[]
  nextParam: ReelPageParam
}

type ProductVectorRow = {
  handle?: string | null
  embedding?: unknown
}

type MatchProductsRow = {
  handle?: string | null
  similarity?: number | null
}

function normalizeHandle(input?: string | null): string {
  if (typeof input !== "string") return ""
  return input.trim().toLowerCase()
}

function stableHash(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

function pseudoRandom01(seed: string): number {
  return (stableHash(seed) % 10000) / 10000
}

function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const parsed = value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
    return parsed.length ? parsed : null
  }
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      const arr = parsed.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
      return arr.length ? arr : null
    }
  } catch {}
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const arr = trimmed
      .slice(1, -1)
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry))
    return arr.length ? arr : null
  }
  return null
}

function matchesGenderFromTags(tags: unknown, gender: "male" | "female" | null): boolean {
  if (!gender) return true
  if (!Array.isArray(tags) || !tags.length) return true
  const normalized = tags.map((tag) => String(tag).trim().toLowerCase())
  if (gender === "male") return normalized.includes("men") || normalized.includes("male")
  return normalized.includes("women") || normalized.includes("female")
}

function genderToShopifyQuery(gender: "male" | "female" | null): string | null {
  if (gender === "male") return "tag:men"
  if (gender === "female") return "tag:women"
  return null
}

async function getSeedEmbedding(seedHandle: string, gender: "male" | "female"): Promise<number[] | null> {
  const normalized = normalizeHandle(seedHandle)
  if (!normalized) return null

  const query = async (handle: string) =>
    supabase.from("product_vectors").select("handle, embedding").eq("gender", gender).eq("handle", handle).limit(1)

  const first = await query(normalized)
  let row = (first.data?.[0] as ProductVectorRow | undefined) ?? null
  if (!row) {
    const fallback = await query(seedHandle)
    row = (fallback.data?.[0] as ProductVectorRow | undefined) ?? null
  }
  if (!row) return null
  return parseEmbedding(row.embedding)
}

async function hydrateByHandles(handles: string[], locale: { country?: string; language?: string }, gender: "male" | "female") {
  const unique = Array.from(new Set(handles.map((handle) => normalizeHandle(handle)).filter(Boolean)))
  const loaded = await Promise.all(unique.map((handle) => getProductByHandle(handle, locale).catch(() => null)))
  return loaded
    .map((entry) => (entry as any)?.product)
    .filter((product) => Boolean(product?.id && product?.handle))
    .filter((product) => product.availableForSale !== false)
    .filter((product) => matchesGenderFromTags(product.tags, gender))
}

async function fillFallback(args: {
  needed: number
  cursor: string | null
  locale: { country?: string; language?: string }
  gender: "male" | "female"
}): Promise<{ items: any[]; cursor: string | null }> {
  const collected: any[] = []
  const seen = new Set<string>()
  let cursor = args.cursor
  let loops = 0
  while (collected.length < args.needed && loops < 4) {
    const page = await getNewestProductsPage(
      {
        pageSize: REEL_PAGE_SIZE * 2,
        after: cursor,
        query: genderToShopifyQuery(args.gender),
      },
      args.locale,
    )
    const hydrated = await hydrateByHandles(
      page.items.map((item) => normalizeHandle(item.handle)),
      args.locale,
      args.gender,
    )
    for (const product of hydrated) {
      const handle = normalizeHandle(product?.handle)
      if (!handle || seen.has(handle)) continue
      seen.add(handle)
      collected.push(product)
      if (collected.length >= args.needed) break
    }
    cursor = page.hasNext ? page.cursor : null
    loops += 1
  }
  return { items: collected.slice(0, args.needed), cursor }
}

export function useForYouReel(seedHandle: string, refreshKey = 0, sessionKey = "") {
  const locale = currentLocale()
  const gender = useFypGenderStore((state) => state.gender)
  const normalizedSeed = normalizeHandle(seedHandle)
  const personalizationGender = gender === "male" || gender === "female" ? gender : null
  const sessionSalt = stableHash(sessionKey || "session")

  return useInfiniteQuery({
    enabled: Boolean(normalizedSeed && personalizationGender),
    queryKey: qk.forYou.reel(
      normalizedSeed,
      locale,
      gender,
      `${normalizedSeed}:${sessionSalt}`,
      REEL_PAGE_SIZE,
      refreshKey,
    ),
    initialPageParam: {
      seedHandle: normalizedSeed,
      offset: 0,
      similarityMin: REEL_SIMILARITY_START,
      fallbackCursor: null,
      seenHandles: normalizedSeed ? [normalizedSeed] : [],
    } as ReelPageParam,
    getNextPageParam: (last: ReelPage) => last.nextParam,
    queryFn: async ({ pageParam }): Promise<ReelPage> => {
      const param = pageParam as ReelPageParam
      const seed = normalizeHandle(param.seedHandle) || normalizedSeed

      if (!personalizationGender) {
        return {
          items: [],
          nextParam: {
            seedHandle: seed,
            offset: 0,
            similarityMin: REEL_SIMILARITY_START,
            fallbackCursor: null,
            seenHandles: param.seenHandles ?? [],
          },
        }
      }

      const seedEmbedding = await getSeedEmbedding(seed, personalizationGender)
      if (!seedEmbedding?.length) {
        const fallback = await fillFallback({
          needed: REEL_PAGE_SIZE,
          cursor: param.fallbackCursor,
          locale,
          gender: personalizationGender,
        })
        const fallbackSeed = normalizeHandle(fallback.items[fallback.items.length - 1]?.handle) || seed
        return {
          items: fallback.items,
          nextParam: {
            seedHandle: fallbackSeed,
            offset: 0,
            similarityMin: REEL_SIMILARITY_START,
            fallbackCursor: fallback.cursor,
            seenHandles: Array.from(
              new Set(
                [...(param.seenHandles ?? []), ...fallback.items.map((item) => normalizeHandle(item?.handle))]
                  .map((entry) => normalizeHandle(entry))
                  .filter(Boolean),
              ),
            ),
          },
        }
      }

      const seen = new Set((param.seenHandles ?? []).map((handle) => normalizeHandle(handle)).filter(Boolean))
      const picked = new Set<string>()
      const handles: string[] = []
      let localOffset = Math.max(0, param.offset)
      let localSimilarity = Math.max(REEL_SIMILARITY_FLOOR, param.similarityMin)
      let attempts = 0
      let exhaustedAtZero = false
      let sawRows = false

      if (localOffset === 0 && Math.abs(localSimilarity - REEL_SIMILARITY_START) < 1e-6 && !seen.has(seed)) {
        picked.add(seed)
        handles.push(seed)
      }

      while (attempts < REEL_MAX_ATTEMPTS && handles.length < REEL_PAGE_SIZE) {
        const rpc = await supabase.rpc("match_products", {
          query_embedding: seedEmbedding,
          match_gender: personalizationGender,
          match_count: REEL_MATCH_FETCH_COUNT,
          match_offset: localOffset,
        })
        const rows = (rpc.data ?? []) as MatchProductsRow[]
        if (rows.length > 0) sawRows = true

        const batch = rows
          .map((row) => ({
            handle: normalizeHandle(row.handle),
            similarity: typeof row.similarity === "number" ? row.similarity : 0,
          }))
          .filter((entry) => entry.handle && entry.similarity >= localSimilarity && !seen.has(entry.handle))
          .sort((a, b) => {
            const jitterA = (pseudoRandom01(`${sessionSalt}:${a.handle}`) - 0.5) * 0.05
            const jitterB = (pseudoRandom01(`${sessionSalt}:${b.handle}`) - 0.5) * 0.05
            return b.similarity + jitterB - (a.similarity + jitterA)
          })
          .map((entry) => entry.handle)

        for (const handle of batch) {
          if (picked.has(handle)) continue
          picked.add(handle)
          handles.push(handle)
          if (handles.length >= REEL_PAGE_SIZE) break
        }

        const tooFew = handles.length < REEL_TARGET_MIN_ITEMS
        const needsBroaden = rows.length === 0 || rows.length < REEL_MATCH_FETCH_COUNT || batch.length === 0 || tooFew

        if (needsBroaden) {
          if (localSimilarity <= REEL_SIMILARITY_FLOOR) {
            exhaustedAtZero = true
            break
          }
          localSimilarity = Math.max(REEL_SIMILARITY_FLOOR, localSimilarity - REEL_SIMILARITY_STEP)
          localOffset = 0
        } else {
          localOffset += REEL_MATCH_FETCH_COUNT
        }
        attempts += 1
      }

      const similarItems = await hydrateByHandles(handles, locale, personalizationGender)
      const items = similarItems.slice(0, REEL_PAGE_SIZE)
      const seenNextBase = Array.from(
        new Set(
          [...(param.seenHandles ?? []), ...items.map((item) => normalizeHandle(item?.handle))]
            .map((entry) => normalizeHandle(entry))
            .filter(Boolean),
        ),
      )

      if (exhaustedAtZero) {
        const fallback = await fillFallback({
          needed: REEL_PAGE_SIZE - items.length,
          cursor: param.fallbackCursor,
          locale,
          gender: personalizationGender,
        })
        const merged = [...items, ...fallback.items].slice(0, REEL_PAGE_SIZE)
        const nextSeed = normalizeHandle(merged[merged.length - 1]?.handle) || seed
        return {
          items: merged,
          nextParam: {
            seedHandle: nextSeed,
            offset: 0,
            similarityMin: REEL_SIMILARITY_START,
            fallbackCursor: fallback.cursor,
            seenHandles: Array.from(
              new Set(
                [...seenNextBase, ...fallback.items.map((item) => normalizeHandle(item?.handle))]
                  .map((entry) => normalizeHandle(entry))
                  .filter(Boolean),
              ),
            ),
          },
        }
      }

      if (!items.length || !sawRows) {
        const fallback = await fillFallback({
          needed: REEL_PAGE_SIZE,
          cursor: param.fallbackCursor,
          locale,
          gender: personalizationGender,
        })
        return {
          items: fallback.items,
          nextParam: {
            seedHandle: seed,
            offset: 0,
            similarityMin: Math.max(REEL_SIMILARITY_FLOOR, localSimilarity - REEL_SIMILARITY_STEP),
            fallbackCursor: fallback.cursor,
            seenHandles: Array.from(
              new Set(
                [...seenNextBase, ...fallback.items.map((item) => normalizeHandle(item?.handle))]
                  .map((entry) => normalizeHandle(entry))
                  .filter(Boolean),
              ),
            ),
          },
        }
      }

      return {
        items,
        nextParam: {
          seedHandle: seed,
          offset: localOffset,
          similarityMin: localSimilarity,
          fallbackCursor: param.fallbackCursor,
          seenHandles: seenNextBase,
        },
      }
    },
  })
}
