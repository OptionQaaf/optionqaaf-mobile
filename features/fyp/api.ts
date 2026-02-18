import { useFypGenderStore } from "@/features/fyp/genderStore"
import { useFypTrackingStore, type ProductAffinityWithComputedScore } from "@/features/fyp/trackingStore"
import { qk } from "@/lib/shopify/queryKeys"
import {
  getNewestProductsPage,
  getProductsByHandles,
  type ProductSearchCandidate,
} from "@/lib/shopify/services/products"
import { supabase } from "@/lib/supabase/client"
import { currentLocale } from "@/store/prefs"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useMemo, useRef } from "react"

export const FYP_PAGE_SIZE = 40
const MIN_SIMILARITY = 0.25
const TARGET_SIMILARITY = 0.4
const MAX_SIMILARITY = 0.96
const PERSONALIZED_SHARE = 0.12
const MIN_PERSONALIZED_ITEMS = 1

type MatchProductsRow = {
  handle?: string | null
  gender?: string | null
  similarity?: number | null
}

type ProductVectorRow = {
  handle?: string | null
  gender?: string | null
  embedding?: unknown
}

export type ForYouPageParam = {
  offset: number
  fallbackCursor: string | null
}

export type ForYouPage = {
  nodes: ProductSearchCandidate[]
  cursor: ForYouPageParam
  hasNext: boolean
}

type WeightedHandle = {
  handle: string
  weightedScore: number
}

function normalizeHandle(input?: string | null): string {
  if (typeof input !== "string") return ""
  return input.trim().toLowerCase()
}

function safeNumber(input: unknown, fallback = 0): number {
  return typeof input === "number" && Number.isFinite(input) ? input : fallback
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
  const hashed = stableHash(seed)
  return (hashed % 10000) / 10000
}

function shuffleBySeed<T>(items: T[], seed: string): T[] {
  const next = items.slice()
  let state = stableHash(seed) || 1
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
  }
  return next
}

function distributeByVendor(items: ProductSearchCandidate[], seed: string): ProductSearchCandidate[] {
  if (items.length <= 2) return items
  const groups = new Map<string, ProductSearchCandidate[]>()
  let unknownCounter = 0

  for (const item of items) {
    const vendor = typeof item.vendor === "string" ? item.vendor.trim().toLowerCase() : ""
    const key = vendor || `__unknown_${unknownCounter++}`
    const bucket = groups.get(key) ?? []
    bucket.push(item)
    groups.set(key, bucket)
  }

  const keys = shuffleBySeed(Array.from(groups.keys()), `${seed}:keys`)
  for (const key of keys) {
    const bucket = groups.get(key)
    if (!bucket) continue
    groups.set(key, shuffleBySeed(bucket, `${seed}:bucket:${key}`))
  }

  const result: ProductSearchCandidate[] = []
  let moved = true
  while (moved) {
    moved = false
    for (const key of keys) {
      const bucket = groups.get(key)
      if (!bucket?.length) continue
      result.push(bucket.shift() as ProductSearchCandidate)
      moved = true
    }
  }

  return result
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
    const entries = trimmed
      .slice(1, -1)
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry))
    return entries.length ? entries : null
  }

  return null
}

function buildProfileHash(weightedProducts: WeightedHandle[], gender: string): string {
  if (!weightedProducts.length) return `${gender}:empty`
  const compact = weightedProducts
    .slice(0, 20)
    .map((entry) => `${normalizeHandle(entry.handle)}:${safeNumber(entry.weightedScore).toFixed(3)}`)
    .join("|")
  return `${gender}:${compact}`
}

async function buildProfileEmbedding(weightedProducts: WeightedHandle[], gender: "male" | "female"): Promise<number[] | null> {
  const scored = weightedProducts
    .map((entry) => ({ handle: normalizeHandle(entry.handle), weight: Math.max(0.01, safeNumber(entry.weightedScore)) }))
    .filter((entry) => entry.handle)
    .slice(0, 20)
  if (!scored.length) return null

  const handles = scored.map((entry) => entry.handle)
  if (__DEV__) {
    console.debug("[fyp] embedding input", {
      gender,
      trackedHandles: handles.length,
      topTrackedHandles: handles.slice(0, 8),
      weightsPreview: scored.slice(0, 8).map((entry) => ({
        handle: entry.handle,
        weight: Number(entry.weight.toFixed(4)),
      })),
    })
  }
  const { data, error } = await supabase
    .from("product_vectors")
    .select("handle, gender, embedding")
    .in("handle", handles)
  if (error || !data?.length) {
    if (__DEV__) {
      console.debug("[fyp] embedding lookup fallback", {
        reason: error ? "supabase_error" : "no_vectors_for_tracked_handles",
        error: error?.message ?? null,
        trackedHandles: handles.length,
        gender,
      })
    }
    return null
  }

  const byHandle = new Map<string, { embedding: number[]; matchesGender: boolean }>()
  for (const row of data as ProductVectorRow[]) {
    const handle = normalizeHandle(row.handle)
    const embedding = parseEmbedding(row.embedding)
    if (!handle || !embedding?.length) continue
    const matchesGender = normalizeHandle(row.gender) === gender
    const existing = byHandle.get(handle)
    if (!existing || (!existing.matchesGender && matchesGender)) {
      byHandle.set(handle, { embedding, matchesGender })
    }
  }

  if (__DEV__) {
    let matchedGenderRows = 0
    const missingHandles = handles.filter((handle) => !byHandle.has(handle))
    for (const entry of byHandle.values()) {
      if (entry.matchesGender) matchedGenderRows += 1
    }
    console.debug("[fyp] embedding lookup", {
      trackedHandles: handles.length,
      foundHandles: byHandle.size,
      matchedGenderRows,
      missingHandlesCount: missingHandles.length,
      missingHandlesPreview: missingHandles.slice(0, 8),
      gender,
    })
  }

  let dimension = 0
  for (const entry of scored) {
    const vector = byHandle.get(entry.handle)?.embedding
    if (!vector?.length) continue
    dimension = vector.length
    break
  }
  if (!dimension) return null

  const sum = new Array<number>(dimension).fill(0)
  let totalWeight = 0
  let usedHandles = 0
  let skippedByDim = 0
  for (const entry of scored) {
    const vector = byHandle.get(entry.handle)?.embedding
    if (!vector) continue
    if (vector.length !== dimension) {
      skippedByDim += 1
      continue
    }
    totalWeight += entry.weight
    usedHandles += 1
    for (let i = 0; i < dimension; i += 1) {
      sum[i] += vector[i] * entry.weight
    }
  }
  if (__DEV__) {
    console.debug("[fyp] embedding composition", {
      gender,
      dimension,
      usedHandles,
      skippedByDim,
      totalWeight: Number(totalWeight.toFixed(6)),
    })
  }
  if (totalWeight <= 0) return null

  return sum.map((value) => value / totalWeight)
}

async function fetchMatchedHandles(args: {
  queryEmbedding: number[]
  gender: "male" | "female"
  profileHash: string
  offset: number
  count: number
}): Promise<string[]> {
  if (__DEV__) {
    console.debug("[fyp] rpc match_products input", {
      gender: args.gender,
      offset: args.offset,
      count: args.count,
      embeddingDimension: args.queryEmbedding.length,
      embeddingNormPreview: args.queryEmbedding.slice(0, 6).map((value) => Number(value.toFixed(6))),
    })
  }
  const { data, error } = await supabase.rpc("match_products", {
    query_embedding: args.queryEmbedding,
    match_gender: args.gender,
    match_count: args.count,
    match_offset: args.offset,
  })
  if (error || !Array.isArray(data)) {
    if (__DEV__) {
      console.debug("[fyp] rpc match_products fallback", {
        reason: error ? "rpc_error" : "invalid_rpc_payload",
        error: error?.message ?? null,
        offset: args.offset,
        count: args.count,
        gender: args.gender,
      })
    }
    return []
  }

  const ranked = (data as MatchProductsRow[])
    .map((row) => {
      const handle = normalizeHandle(row.handle)
      const similarity = safeNumber(row.similarity, 0)
      if (!handle || similarity < MIN_SIMILARITY) return null
      const cappedSimilarity = Math.min(similarity, MAX_SIMILARITY)
      const nearTargetBonus = similarity >= TARGET_SIMILARITY ? 0.025 : -0.02
      const jitter = (pseudoRandom01(`${args.profileHash}:${handle}`) - 0.5) * 0.08
      return {
        handle,
        score: cappedSimilarity + nearTargetBonus + jitter,
      }
    })
    .filter((entry): entry is { handle: string; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score)

  if (__DEV__) {
    const rows = data as MatchProductsRow[]
    const similarityValues = rows
      .map((row) => safeNumber(row.similarity, Number.NaN))
      .filter((value) => Number.isFinite(value))
    const minSimilarity = similarityValues.length ? Math.min(...similarityValues) : null
    const maxSimilarity = similarityValues.length ? Math.max(...similarityValues) : null
    const avgSimilarity = similarityValues.length
      ? similarityValues.reduce((sum, value) => sum + value, 0) / similarityValues.length
      : null
    console.debug("[fyp] rpc match_products output", {
      rawRows: rows.length,
      rankedRows: ranked.length,
      minSimilarity: minSimilarity == null ? null : Number(minSimilarity.toFixed(6)),
      maxSimilarity: maxSimilarity == null ? null : Number(maxSimilarity.toFixed(6)),
      avgSimilarity: avgSimilarity == null ? null : Number(avgSimilarity.toFixed(6)),
      rankedPreview: ranked.slice(0, 8).map((entry) => ({
        handle: entry.handle,
        score: Number(entry.score.toFixed(6)),
      })),
    })
  }

  if (!ranked.length) return []

  const tierSize = Math.max(1, Math.ceil(ranked.length / 3))
  const high = ranked.slice(0, tierSize)
  const mid = ranked.slice(tierSize, tierSize * 2)
  const low = ranked.slice(tierSize * 2)
  const tiers: Array<Array<{ handle: string; score: number }>> = [high, mid, low]

  const rotateBy = stableHash(`${args.profileHash}:${args.offset}`) % 3
  const tierOrder = [0, 1, 2].map((_, idx) => (idx + rotateBy) % 3)

  const diversified: Array<{ handle: string; score: number }> = []
  let moved = true
  while (moved) {
    moved = false
    for (const tierIndex of tierOrder) {
      const next = tiers[tierIndex].shift()
      if (!next) continue
      diversified.push(next)
      moved = true
    }
  }

  const unique = new Set<string>()
  const handles: string[] = []
  for (const entry of diversified) {
    if (unique.has(entry.handle)) continue
    unique.add(entry.handle)
    handles.push(entry.handle)
  }
  return handles
}

function matchesGenderFromTags(item: ProductSearchCandidate, gender: "male" | "female" | null): boolean {
  if (!gender) return true
  const tags = Array.isArray(item.tags) ? item.tags.map((tag) => String(tag).trim().toLowerCase()) : []
  if (!tags.length) return true
  if (gender === "male") return tags.includes("men") || tags.includes("male")
  if (gender === "female") return tags.includes("women") || tags.includes("female")
  return true
}

function genderToShopifyQuery(gender: "male" | "female" | null): string | null {
  if (gender === "male") return "tag:men"
  if (gender === "female") return "tag:women"
  return null
}

function filterHydratedProductsByGender(
  items: ProductSearchCandidate[],
  excludedHandles: Set<string>,
  gender: "male" | "female" | null,
): ProductSearchCandidate[] {
  const next: ProductSearchCandidate[] = []
  const seen = new Set<string>(excludedHandles)
  let skippedDuplicate = 0
  let skippedOutOfStock = 0
  let skippedGender = 0
  for (const item of items) {
    const handle = normalizeHandle(item.handle)
    if (!handle || seen.has(handle)) {
      skippedDuplicate += 1
      continue
    }
    if (item.availableForSale === false) {
      skippedOutOfStock += 1
      continue
    }
    if (!matchesGenderFromTags(item, gender)) {
      skippedGender += 1
      continue
    }
    seen.add(handle)
    next.push(item)
  }
  if (__DEV__) {
    console.debug("[fyp] hydrate filter", {
      input: items.length,
      kept: next.length,
      skippedDuplicate,
      skippedOutOfStock,
      skippedGender,
      gender,
    })
  }
  return next
}

async function fillFromNewest(args: {
  needed: number
  cursor: string | null
  locale: { country?: string; language?: string }
  excludedHandles: Set<string>
  gender: "male" | "female" | null
}): Promise<{ items: ProductSearchCandidate[]; cursor: string | null; hasNext: boolean }> {
  const collected: ProductSearchCandidate[] = []
  const seen = new Set<string>(args.excludedHandles)
  let cursor = args.cursor
  let hasNext = true
  let guard = 0

  while (collected.length < args.needed && hasNext && guard < 5) {
    const page = await getNewestProductsPage(
      {
        pageSize: Math.max(FYP_PAGE_SIZE, args.needed * 2),
        after: cursor,
        query: genderToShopifyQuery(args.gender),
      },
      args.locale,
    )
    cursor = page.cursor
    hasNext = page.hasNext
    guard += 1

    for (const item of page.items) {
      const handle = normalizeHandle(item.handle)
      if (!handle || seen.has(handle)) continue
      if (item.availableForSale === false) continue
      if (!matchesGenderFromTags(item, args.gender)) continue
      seen.add(handle)
      collected.push(item)
      if (collected.length >= args.needed) break
    }

    if (!hasNext) break
  }

  if (__DEV__) {
    console.debug("[fyp] fallback newest", {
      needed: args.needed,
      filled: collected.length,
      guard,
      hasNext,
      cursor,
      gender: args.gender,
      query: genderToShopifyQuery(args.gender),
    })
  }

  return { items: collected, cursor, hasNext }
}

export function useForYouProducts(pageSize = FYP_PAGE_SIZE, refreshKey = 0, enabled = true) {
  const locale = currentLocale()
  const gender = useFypGenderStore((state) => state.gender)
  const trackedProducts = useFypTrackingStore((state) => state.products)
  const getWeightedProducts = useFypTrackingStore((state) => state.getWeightedProducts)

  const weighted = useMemo<WeightedHandle[]>(() => {
    const list = getWeightedProducts() as ProductAffinityWithComputedScore[]
    return list
      .map((entry) => ({
        handle: entry.handle,
        weightedScore: entry.weightedScore,
      }))
      .filter((entry) => normalizeHandle(entry.handle))
  }, [getWeightedProducts, trackedProducts])

  const personalizationGender = gender === "male" || gender === "female" ? gender : null
  const trackedForProfile = useMemo(() => weighted.slice(0, 20), [weighted])
  const profileHash = useMemo(
    () => buildProfileHash(trackedForProfile, personalizationGender ?? "fallback"),
    [trackedForProfile, personalizationGender],
  )
  const embeddingCacheRef = useRef<{ hash: string; embedding: number[] | null } | null>(null)

  const personalizationEnabled = Boolean(personalizationGender && trackedForProfile.length)

  return useInfiniteQuery({
    queryKey: qk.forYou.products(locale, gender, profileHash, pageSize, null, refreshKey),
    queryFn: async ({ pageParam }): Promise<ForYouPage> => {
      const param = pageParam as ForYouPageParam
      const seedBase = `${profileHash}:${refreshKey}`
      const excludedHandles = new Set<string>()
      for (const entry of trackedForProfile) {
        const handle = normalizeHandle(entry.handle)
        if (handle) excludedHandles.add(handle)
      }

      const nodes: ProductSearchCandidate[] = []
      let fallbackCursor = param.fallbackCursor
      let fallbackHasNext = true
      let matchedHandlesCount = 0
      const personalizationReason = personalizationEnabled
        ? "enabled"
        : !personalizationGender
          ? "gender_unknown"
          : "no_tracked_products"

      if (personalizationEnabled && personalizationGender) {
        let profileEmbedding = embeddingCacheRef.current?.hash === profileHash ? embeddingCacheRef.current.embedding : null
        if (__DEV__) {
          console.debug("[fyp] personalization gate", {
            personalizationEnabled,
            personalizationReason,
            gender,
            trackedProductsCount: trackedForProfile.length,
            excludedHandlesCount: excludedHandles.size,
            offset: param.offset,
            cacheHit: Boolean(profileEmbedding),
          })
        }
        if (!profileEmbedding) {
          profileEmbedding = await buildProfileEmbedding(trackedForProfile, personalizationGender)
          embeddingCacheRef.current = { hash: profileHash, embedding: profileEmbedding }
        }

        if (profileEmbedding?.length) {
          const matchedHandles = await fetchMatchedHandles({
            queryEmbedding: profileEmbedding,
            gender: personalizationGender,
            profileHash: seedBase,
            offset: param.offset,
            count: pageSize * 4,
          })
          matchedHandlesCount = matchedHandles.length
          if (matchedHandles.length) {
            const hydrated = await getProductsByHandles(matchedHandles, locale, { chunkSize: 25 })
            if (__DEV__) {
              console.debug("[fyp] hydrate matched", {
                requestedHandles: matchedHandles.length,
                hydrated: hydrated.length,
                firstRequested: matchedHandles.slice(0, 8),
                firstHydrated: hydrated.slice(0, 8).map((entry) => normalizeHandle(entry.handle)),
              })
            }
            const filtered = filterHydratedProductsByGender(hydrated, excludedHandles, personalizationGender)
            const personalizedTarget = Math.max(
              MIN_PERSONALIZED_ITEMS,
              Math.min(pageSize, Math.round(pageSize * PERSONALIZED_SHARE)),
            )
            nodes.push(...filtered.slice(0, personalizedTarget))
            for (const product of nodes) {
              const handle = normalizeHandle(product.handle)
              if (handle) excludedHandles.add(handle)
            }
          }
        }
      }

      if (nodes.length < pageSize) {
        const fill = await fillFromNewest({
          needed: pageSize - nodes.length,
          cursor: fallbackCursor,
          locale,
          excludedHandles,
          gender: personalizationGender,
        })
        fallbackCursor = fill.cursor
        fallbackHasNext = fill.hasNext
        nodes.push(...fill.items)
      }

      if (__DEV__) {
        console.debug("[fyp] page", {
          personalizationEnabled,
          personalizationReason,
          gender,
          trackedProductsCount: trackedForProfile.length,
          matchedHandlesCount,
          personalizedCount: nodes.length,
          fallbackUsed: nodes.length > 0 && nodes.length > Math.min(pageSize, matchedHandlesCount),
          pageSize,
          returnedCount: nodes.length,
          offset: param.offset,
          fallbackCursor,
          refreshKey,
        })
      }

      const randomizedNodes = distributeByVendor(
        shuffleBySeed(nodes.slice(0, pageSize), `${seedBase}:${param.offset}:page`),
        `${seedBase}:${param.offset}:vendor`,
      )

      const hasNext = personalizationEnabled ? matchedHandlesCount > 0 || fallbackHasNext : fallbackHasNext
      return {
        nodes: randomizedNodes,
        cursor: {
          offset: param.offset + pageSize,
          fallbackCursor,
        },
        hasNext,
      }
    },
    enabled,
    initialPageParam: { offset: 0, fallbackCursor: null } as ForYouPageParam,
    getNextPageParam: (last) => (last.hasNext ? last.cursor : undefined),
  })
}
