import { useFypExposureStore } from "@/features/fyp/exposureStore"
import { useFypGenderStore } from "@/features/fyp/genderStore"
import { useFypTrackingStore, type ProductAffinityWithComputedScore } from "@/features/fyp/trackingStore"
import { createLogger } from "@/lib/diagnostics/logger"
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
const PERSONALIZED_SHARE = 0.4
const MIN_PERSONALIZED_ITEMS = 8
const MATCH_FETCH_MULTIPLIER = 3
const MAX_PERSONALIZED_HYDRATE_HANDLES = 48
const MAX_FALLBACK_LOOPS = 4
const PERSONALIZED_HYDRATE_TIMEOUT_MS = 8000
const NEWEST_PAGE_TIMEOUT_MS = 7000
const MATCH_RPC_TIMEOUT_MS = 4500
const EMBEDDING_LOOKUP_TIMEOUT_MS = 3000
const NEWEST_PAGE_MIN_SIZE = 24
const NEWEST_PAGE_MAX_SIZE = 48
const NEWEST_PAGE_PADDING = 12
const log = createLogger("fyp:products")
let matchProductsExcludeHandlesSupport: boolean | null = null

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

type FilterStats = {
  skippedDuplicateOrExcluded: number
  skippedOutOfStock: number
  skippedGender: number
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

function shuffleInChunks<T>(items: T[], seed: string, chunkSize = 6): T[] {
  if (items.length <= 2) return items
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  const shuffledChunks = chunks.map((chunk, idx) => shuffleBySeed(chunk, `${seed}:chunk:${idx}`))
  const order = shuffleBySeed(
    shuffledChunks.map((_, idx) => idx),
    `${seed}:order`,
  )
  return order.flatMap((idx) => shuffledChunks[idx])
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

async function buildProfileEmbedding(
  weightedProducts: WeightedHandle[],
  gender: "male" | "female",
): Promise<number[] | null> {
  const scored = weightedProducts
    .map((entry) => ({
      handle: normalizeHandle(entry.handle),
      weight: Math.max(0.01, safeNumber(entry.weightedScore)),
    }))
    .filter((entry) => entry.handle)
    .slice(0, 20)
  if (!scored.length) return null

  const handles = scored.map((entry) => entry.handle)
  if (__DEV__) {
    log.debug("embedding input", {
      gender,
      trackedHandles: handles.length,
      topTrackedHandles: handles.slice(0, 8),
      weightsPreview: scored.slice(0, 8).map((entry) => ({
        handle: entry.handle,
        weight: Number(entry.weight.toFixed(4)),
      })),
    })
  }
  const embeddingLookup = await withTimeout(
    supabase.from("product_vectors").select("handle, gender, embedding").in("handle", handles),
    EMBEDDING_LOOKUP_TIMEOUT_MS,
    "embedding_lookup",
  )
  const data = embeddingLookup?.data
  const error = embeddingLookup?.error
  if (error || !data?.length) {
    if (__DEV__) {
      log.debug("embedding lookup fallback", {
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
    log.debug("embedding lookup", {
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
    log.debug("embedding composition", {
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
  excludedHandles: Set<string>
}): Promise<string[]> {
  if (__DEV__) {
    log.debug("rpc match_products input", {
      gender: args.gender,
      offset: args.offset,
      count: args.count,
      embeddingDimension: args.queryEmbedding.length,
      embeddingNormPreview: args.queryEmbedding.slice(0, 6).map((value) => Number(value.toFixed(6))),
    })
  }
  const legacyCall = () =>
    supabase.rpc("match_products", {
      query_embedding: args.queryEmbedding,
      match_gender: args.gender,
      match_count: args.count,
      match_offset: args.offset,
    })

  let rpc
  if (matchProductsExcludeHandlesSupport === false) {
    rpc = await legacyCall()
  } else {
    rpc = await supabase.rpc("match_products", {
      query_embedding: args.queryEmbedding,
      match_gender: args.gender,
      match_count: args.count,
      match_offset: args.offset,
      exclude_handles: Array.from(args.excludedHandles),
    })

    // Backward compatible with older RPC signature in environments that do not yet support exclude_handles.
    if (rpc.error) {
      const message = String(rpc.error.message ?? "").toLowerCase()
      if (message.includes("could not find the function public.match_products(exclude_handles")) {
        matchProductsExcludeHandlesSupport = false
      }
      rpc = await legacyCall()
    } else {
      matchProductsExcludeHandlesSupport = true
    }
  }

  const { data, error } = rpc
  if (error || !Array.isArray(data)) {
    if (__DEV__) {
      log.debug("rpc match_products fallback", {
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
      const jitter = (pseudoRandom01(`${args.profileHash}:${handle}`) - 0.5) * 0.22
      const explorationBonus = (pseudoRandom01(`${args.profileHash}:explore:${handle}`) - 0.5) * 0.14
      const tooSimilarPenalty = similarity > 0.94 ? 0.04 : 0
      return {
        handle,
        score: cappedSimilarity + nearTargetBonus + jitter + explorationBonus - tooSimilarPenalty,
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
    log.debug("rpc match_products output", {
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
  const tiers: { handle: string; score: number }[][] = [high, mid, low]

  const rotateBy = stableHash(`${args.profileHash}:${args.offset}`) % 3
  const tierOrder = [0, 1, 2].map((_, idx) => (idx + rotateBy) % 3)

  const diversified: { handle: string; score: number }[] = []
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
  let skippedExcluded = 0
  const chaotic = shuffleInChunks(diversified, `${args.profileHash}:${args.offset}:matched`)
  for (const entry of chaotic) {
    if (unique.has(entry.handle)) continue
    if (args.excludedHandles.has(entry.handle)) {
      skippedExcluded += 1
      continue
    }
    unique.add(entry.handle)
    handles.push(entry.handle)
  }
  if (__DEV__) {
    log.debug("rpc match_products post_filter", {
      offset: args.offset,
      count: args.count,
      rawHandles: chaotic.length,
      returnedHandles: handles.length,
      skippedExcluded,
      excludedHandlesCount: args.excludedHandles.size,
    })
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
): { items: ProductSearchCandidate[]; stats: FilterStats } {
  const next: ProductSearchCandidate[] = []
  const seen = new Set<string>(excludedHandles)
  let skippedDuplicateOrExcluded = 0
  let skippedOutOfStock = 0
  let skippedGender = 0
  for (const item of items) {
    const handle = normalizeHandle(item.handle)
    if (!handle || seen.has(handle)) {
      skippedDuplicateOrExcluded += 1
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
    log.debug("hydrate filter", {
      input: items.length,
      kept: next.length,
      skippedDuplicateOrExcluded,
      skippedOutOfStock,
      skippedGender,
      gender,
    })
  }
  return {
    items: next,
    stats: {
      skippedDuplicateOrExcluded,
      skippedOutOfStock,
      skippedGender,
    },
  }
}

async function fillFromNewest(args: {
  needed: number
  cursor: string | null
  locale: { country?: string; language?: string }
  excludedHandles: Set<string>
  gender: "male" | "female" | null
}): Promise<{ items: ProductSearchCandidate[]; cursor: string | null; hasNext: boolean; stats: FilterStats }> {
  const collected: ProductSearchCandidate[] = []
  const seen = new Set<string>(args.excludedHandles)
  let cursor = args.cursor
  let hasNext = true
  let guard = 0
  let skippedDuplicateOrExcluded = 0
  let skippedOutOfStock = 0
  let skippedGender = 0

  while (collected.length < args.needed && hasNext && guard < MAX_FALLBACK_LOOPS) {
    const page = await withTimeout(
      getNewestProductsPage(
        {
          pageSize: Math.max(NEWEST_PAGE_MIN_SIZE, Math.min(NEWEST_PAGE_MAX_SIZE, args.needed + NEWEST_PAGE_PADDING)),
          after: cursor,
          query: genderToShopifyQuery(args.gender),
        },
        args.locale,
      ),
      NEWEST_PAGE_TIMEOUT_MS,
      "newest_page",
    )
    if (!page) {
      hasNext = false
      break
    }
    cursor = page.cursor
    hasNext = page.hasNext
    guard += 1

    for (const item of page.items) {
      const handle = normalizeHandle(item.handle)
      if (!handle || seen.has(handle)) {
        skippedDuplicateOrExcluded += 1
        continue
      }
      if (item.availableForSale === false) {
        skippedOutOfStock += 1
        continue
      }
      if (!matchesGenderFromTags(item, args.gender)) {
        skippedGender += 1
        continue
      }
      seen.add(handle)
      collected.push(item)
      if (collected.length >= args.needed) break
    }

    if (!hasNext) break
  }

  if (__DEV__) {
    log.debug("fallback newest", {
      needed: args.needed,
      filled: collected.length,
      guard,
      hasNext,
      cursor,
      gender: args.gender,
      query: genderToShopifyQuery(args.gender),
      skippedDuplicateOrExcluded,
      skippedOutOfStock,
      skippedGender,
    })
  }

  return {
    items: collected,
    cursor,
    hasNext,
    stats: {
      skippedDuplicateOrExcluded,
      skippedOutOfStock,
      skippedGender,
    },
  }
}

function interleaveCandidates(
  personalized: ProductSearchCandidate[],
  exploration: ProductSearchCandidate[],
  pageSize: number,
  personalizedTarget: number,
): ProductSearchCandidate[] {
  const personalizedCap = Math.max(0, Math.min(personalized.length, personalizedTarget, pageSize))
  const explorationCap = Math.max(0, Math.min(exploration.length, pageSize))
  const result: ProductSearchCandidate[] = []
  let p = 0
  let e = 0
  const cadence = Math.max(1, Math.round(pageSize / Math.max(1, personalizedCap)))

  while (result.length < pageSize && (p < personalizedCap || e < explorationCap)) {
    const remainingSlots = pageSize - result.length
    const remainingPersonalized = personalizedCap - p
    const shouldPickPersonalized =
      remainingPersonalized > 0 &&
      (result.length % cadence === 0 || remainingPersonalized >= remainingSlots || e >= explorationCap)

    if (shouldPickPersonalized && p < personalizedCap) {
      result.push(personalized[p] as ProductSearchCandidate)
      p += 1
      continue
    }

    if (e < explorationCap) {
      result.push(exploration[e] as ProductSearchCandidate)
      e += 1
      continue
    }

    if (p < personalizedCap) {
      result.push(personalized[p] as ProductSearchCandidate)
      p += 1
    }
  }

  return result
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs)
      }),
    ])
  } catch (error) {
    if (__DEV__) {
      log.debug("request timeout/failure", {
        label,
        timeoutMs,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return null
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function useForYouProducts(pageSize = FYP_PAGE_SIZE, refreshKey = 0, enabled = true) {
  const locale = currentLocale()
  const gender = useFypGenderStore((state) => state.gender)
  const getWeightedProducts = useFypTrackingStore((state) => state.getWeightedProducts)
  const exposureGender = gender === "male" || gender === "female" ? gender : "unknown"

  const weighted = useMemo<WeightedHandle[]>(() => {
    const list = getWeightedProducts() as ProductAffinityWithComputedScore[]
    return list
      .map((entry) => ({
        handle: entry.handle,
        weightedScore: entry.weightedScore,
      }))
      .filter((entry) => normalizeHandle(entry.handle))
  }, [getWeightedProducts, refreshKey])

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
      const exposure = useFypExposureStore.getState()
      const seenHandles = exposure.getSeenHandles(exposureGender)
      for (const entry of trackedForProfile) {
        const handle = normalizeHandle(entry.handle)
        if (handle) excludedHandles.add(handle)
      }
      for (const handle of seenHandles) {
        excludedHandles.add(normalizeHandle(handle))
      }

      const personalizedNodes: ProductSearchCandidate[] = []
      const explorationNodes: ProductSearchCandidate[] = []
      let fallbackCursor =
        param.fallbackCursor ??
        (param.offset === 0 ? useFypExposureStore.getState().getNewestCursor(exposureGender) : null)
      let fallbackHasNext = true
      let matchedHandlesCount = 0
      let hydratedMatchedCount = 0
      let personalizedFilteredOut = 0
      let repeatedPreventedCount = 0
      const personalizationReason = personalizationEnabled
        ? "enabled"
        : !personalizationGender
          ? "gender_unknown"
          : "no_tracked_products"

      const personalizedTarget = Math.max(
        MIN_PERSONALIZED_ITEMS,
        Math.min(pageSize, Math.round(pageSize * PERSONALIZED_SHARE)),
      )

      if (personalizationEnabled && personalizationGender) {
        let profileEmbedding =
          embeddingCacheRef.current?.hash === profileHash ? embeddingCacheRef.current.embedding : null
        if (__DEV__) {
          log.debug("personalization gate", {
            personalizationEnabled,
            personalizationReason,
            gender,
            trackedProductsCount: trackedForProfile.length,
            excludedHandlesCount: excludedHandles.size,
            excludedSeenCount: seenHandles.length,
            offset: param.offset,
            cacheHit: Boolean(profileEmbedding),
            fallbackCursorStart: fallbackCursor,
          })
        }
        if (!profileEmbedding) {
          profileEmbedding = await buildProfileEmbedding(trackedForProfile, personalizationGender)
          embeddingCacheRef.current = { hash: profileHash, embedding: profileEmbedding }
        }

        if (profileEmbedding?.length) {
          const matchedHandles =
            (await withTimeout(
              fetchMatchedHandles({
                queryEmbedding: profileEmbedding,
                gender: personalizationGender,
                profileHash: seedBase,
                offset: param.offset,
                count: pageSize * MATCH_FETCH_MULTIPLIER,
                excludedHandles,
              }),
              MATCH_RPC_TIMEOUT_MS,
              "match_products_rpc",
            )) ?? []
          matchedHandlesCount = matchedHandles.length
          if (matchedHandles.length) {
            const hydrationLimit = Math.min(
              MAX_PERSONALIZED_HYDRATE_HANDLES,
              Math.max(personalizedTarget * 3, personalizedTarget + 12),
              matchedHandles.length,
            )
            const handlesForHydration = matchedHandles.slice(0, hydrationLimit)
            const hydrated = await withTimeout(
              getProductsByHandles(handlesForHydration, locale, { chunkSize: 30 }),
              PERSONALIZED_HYDRATE_TIMEOUT_MS,
              "hydrate_matched",
            )
            if (hydrated?.length) {
              hydratedMatchedCount = hydrated.length
              if (__DEV__) {
                log.debug("hydrate matched", {
                  requestedHandles: matchedHandles.length,
                  hydrationLimit,
                  hydrated: hydrated.length,
                  firstRequested: handlesForHydration.slice(0, 8),
                  firstHydrated: hydrated.slice(0, 8).map((entry) => normalizeHandle(entry.handle)),
                })
              }
              const filtered = filterHydratedProductsByGender(hydrated, excludedHandles, personalizationGender)
              personalizedFilteredOut =
                filtered.stats.skippedDuplicateOrExcluded +
                filtered.stats.skippedGender +
                filtered.stats.skippedOutOfStock
              personalizedNodes.push(...filtered.items.slice(0, personalizedTarget))
              for (const product of personalizedNodes) {
                const handle = normalizeHandle(product.handle)
                if (handle) excludedHandles.add(handle)
              }
            }
          }
        }
      }

      if (personalizedNodes.length < pageSize) {
        const explorationNeeded = pageSize - personalizedNodes.length
        const fill = await fillFromNewest({
          needed: explorationNeeded,
          cursor: fallbackCursor,
          locale,
          excludedHandles,
          gender: personalizationGender,
        })
        fallbackCursor = fill.cursor
        fallbackHasNext = fill.hasNext
        repeatedPreventedCount =
          fill.stats.skippedDuplicateOrExcluded + fill.stats.skippedGender + fill.stats.skippedOutOfStock
        explorationNodes.push(...fill.items)
      }

      const composed = interleaveCandidates(
        shuffleInChunks(personalizedNodes, `${seedBase}:${param.offset}:personalized`),
        shuffleInChunks(explorationNodes, `${seedBase}:${param.offset}:exploration`),
        pageSize,
        personalizedTarget,
      )
      for (const product of composed) {
        const handle = normalizeHandle(product.handle)
        if (handle) excludedHandles.add(handle)
      }

      if (__DEV__) {
        const compositionReport = composed.slice(0, 8).map((entry) => ({
          handle: normalizeHandle(entry.handle),
          vendor: normalizeHandle(entry.vendor),
        }))
        log.debug("page", {
          personalizationEnabled,
          personalizationReason,
          gender,
          trackedProductsCount: trackedForProfile.length,
          excludedSeenCount: seenHandles.length,
          matchedHandlesCount,
          hydratedMatchedCount,
          personalizedFilteredOut,
          personalizedTarget,
          personalizedUsedCount: personalizedNodes.length,
          explorationUsedCount: explorationNodes.length,
          fallbackUsed: explorationNodes.length > 0,
          repeatedPreventedCount,
          pageSize,
          returnedCount: composed.length,
          offset: param.offset,
          fallbackCursor,
          refreshKey,
          compositionReport,
        })
      }

      const randomizedNodes = distributeByVendor(
        shuffleInChunks(
          shuffleBySeed(composed.slice(0, pageSize), `${seedBase}:${param.offset}:page`),
          `${seedBase}:${param.offset}:mix`,
        ),
        `${seedBase}:${param.offset}:vendor`,
      )

      useFypExposureStore.getState().markServed(
        exposureGender,
        randomizedNodes.map((node) => normalizeHandle(node.handle)),
      )
      useFypExposureStore.getState().setNewestCursor(exposureGender, fallbackCursor)

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
