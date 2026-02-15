import { getCachedProductIntelligence, type PrimaryCategory } from "@/features/catalog/intelligence"
import { fypLogOnce, fypTableOnce, setFypDebugPanelEntry } from "@/features/debug/fypDebug"
import { extractForYouContentSignals } from "@/features/for-you/contentSignals"
import {
  deriveSignalTags,
  getEffectiveScore,
  normalizeForYouProfile,
  normalizeGender,
  type ForYouCandidate,
  type ForYouProfile,
} from "@/features/for-you/profile"
import { getForYouProfile, resolveForYouCollectionHandles } from "@/features/for-you/service"
import { incrementForYouTelemetryCounter, recordForYouTelemetryTiming } from "@/features/for-you/telemetry"
import { getForYouCandidates } from "@/lib/shopify/services/forYou"
import { getProductByHandle, searchProductsByTerms, type ProductSearchCandidate } from "@/lib/shopify/services/products"
import { getRecommendedProducts } from "@/lib/shopify/services/recommendations"

const REEL_POOL_TARGET = 220
const REEL_PAGE_DEFAULT = 14
const EARLY_CATEGORY_WINDOW = 10
const MAX_SERVED_TRACK = 320

const GENERIC_SEED_TERMS = new Set([
  "men",
  "women",
  "man",
  "woman",
  "new",
  "sale",
  "all",
  "arrivals",
  "arrival",
  "new-in",
  "new_arrivals",
])

type ReelCursor = {
  page: number
  searchAfter: string | null
  collectionCursor: string | null
  servedHandles: string[]
}

type ReelRankDebug = {
  seedSimilarity: number
  similarityScore: number
  userAffinity: number
  exploration: number
  categoryPenalty: number
  adjacentBonus: number
  categoryMatch: boolean
  materialOverlap: number
  fitOverlap: number
  styleOverlap: number
  normalizedOverlapCount: number
  penaltyApplied: number
}

type ReelRankedItem = ForYouCandidate & {
  __score: number
  __category: PrimaryCategory
  __debug?: ReelRankDebug
}

function normalize(value?: string | null): string {
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase()
}

function unique(items: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    if (!item || seen.has(item)) continue
    seen.add(item)
    out.push(item)
    if (out.length >= limit) break
  }
  return out
}

function decodeReelCursor(cursor?: string | null): ReelCursor {
  if (!cursor) return { page: 0, searchAfter: null, collectionCursor: null, servedHandles: [] }
  try {
    const parsed = JSON.parse(cursor) as ReelCursor
    return {
      page: Number.isFinite(parsed.page) ? Math.max(0, parsed.page) : 0,
      searchAfter: typeof parsed.searchAfter === "string" ? parsed.searchAfter : null,
      collectionCursor: typeof parsed.collectionCursor === "string" ? parsed.collectionCursor : null,
      servedHandles: Array.isArray(parsed.servedHandles) ? parsed.servedHandles.map(normalize).filter(Boolean) : [],
    }
  } catch {
    return { page: 0, searchAfter: null, collectionCursor: null, servedHandles: [] }
  }
}

function encodeReelCursor(cursor: ReelCursor): string {
  return JSON.stringify(cursor)
}

function asCandidate(input: ProductSearchCandidate): ForYouCandidate {
  return {
    id: input.id,
    handle: input.handle,
    title: input.title ?? null,
    vendor: input.vendor ?? null,
    productType: input.productType ?? null,
    tags: input.tags ?? null,
    createdAt: input.createdAt ?? null,
    availableForSale: input.availableForSale ?? null,
    featuredImage: input.featuredImage ?? null,
    priceRange: input.priceRange ?? null,
    compareAtPriceRange: input.compareAtPriceRange ?? null,
  }
}

function toCandidateFromProduct(product: any): ForYouCandidate | null {
  if (!product?.id || !product?.handle) return null
  const variants = (product?.variants?.nodes ?? []).filter(Boolean)
  let minPrice = Number.POSITIVE_INFINITY
  let maxPrice = 0
  let minCompare = Number.POSITIVE_INFINITY
  let maxCompare = 0
  let currencyCode = "USD"
  let availableForSale = false
  for (const variant of variants) {
    const amount = Number(variant?.price?.amount ?? 0)
    const compare = Number(variant?.compareAtPrice?.amount ?? 0)
    if (Number.isFinite(amount)) {
      minPrice = Math.min(minPrice, amount)
      maxPrice = Math.max(maxPrice, amount)
    }
    if (Number.isFinite(compare) && compare > 0) {
      minCompare = Math.min(minCompare, compare)
      maxCompare = Math.max(maxCompare, compare)
    }
    if (variant?.price?.currencyCode) currencyCode = String(variant.price.currencyCode)
    if (variant?.availableForSale !== false) availableForSale = true
  }
  if (!Number.isFinite(minPrice)) minPrice = 0
  if (!Number.isFinite(maxPrice) || maxPrice <= 0) maxPrice = minPrice
  if (!Number.isFinite(minCompare) || minCompare <= 0) minCompare = minPrice
  if (!Number.isFinite(maxCompare) || maxCompare <= 0) maxCompare = minCompare
  const mediaImages = (product?.media?.nodes ?? [])
    .map((node: any) => node?.image)
    .filter(Boolean)
    .slice(0, 6)

  return {
    id: String(product.id),
    handle: String(product.handle),
    title: typeof product.title === "string" ? product.title : null,
    vendor: typeof product.vendor === "string" ? product.vendor : null,
    productType: typeof product.productType === "string" ? product.productType : null,
    tags: Array.isArray(product.tags) ? product.tags : null,
    createdAt: typeof product.createdAt === "string" ? product.createdAt : null,
    availableForSale,
    featuredImage: product.featuredImage
      ? {
          id: product.featuredImage.id ?? null,
          url: product.featuredImage.url ?? null,
          altText: product.featuredImage.altText ?? null,
          width: product.featuredImage.width ?? null,
          height: product.featuredImage.height ?? null,
        }
      : null,
    images: {
      nodes: mediaImages.map((image: any) => ({
        id: image?.id ?? null,
        url: image?.url ?? null,
        altText: image?.altText ?? null,
        width: image?.width ?? null,
        height: image?.height ?? null,
      })),
    },
    priceRange: {
      minVariantPrice: { amount: String(minPrice), currencyCode },
      maxVariantPrice: { amount: String(maxPrice), currencyCode },
    },
    compareAtPriceRange: {
      minVariantPrice: { amount: String(minCompare), currencyCode },
      maxVariantPrice: { amount: String(maxCompare), currencyCode },
    },
  }
}

export function getSeedTermSet(
  seedProduct: ForYouCandidate & { descriptionHtml?: string | null; description?: string | null },
) {
  const derived = deriveSignalTags({
    baseTags: seedProduct.tags ?? [],
    handle: seedProduct.handle,
    title: seedProduct.title ?? null,
    vendor: seedProduct.vendor ?? null,
    productType: seedProduct.productType ?? null,
  })
  const content = extractForYouContentSignals({
    descriptionHtml: seedProduct.descriptionHtml ?? null,
    description: seedProduct.description ?? null,
    handle: seedProduct.handle,
    title: seedProduct.title ?? null,
    vendor: seedProduct.vendor ?? null,
    productType: seedProduct.productType ?? null,
    imageAltTexts: [seedProduct.featuredImage?.altText ?? null],
  })

  const combined = unique(
    [...derived, ...content]
      .map(normalize)
      .filter((entry) => entry.length >= 3 && !GENERIC_SEED_TERMS.has(entry) && !/^\d+$/.test(entry)),
    36,
  )
  const intelligence = getCachedProductIntelligence(seedProduct)
  return {
    seedTerms: unique([...intelligence.normalizedTerms, ...combined], 40),
    seedDerivedTags: unique(derived.map(normalize), 24),
    seedPrimaryCategory: intelligence.primaryCategory as PrimaryCategory,
  }
}

function getUserAffinityScore(profile: ForYouProfile, candidate: ForYouCandidate): number {
  const now = Date.now()
  const handle = normalize(candidate.handle)
  const vendor = normalize(candidate.vendor)
  const productType = normalize(candidate.productType)
  const tags = deriveSignalTags({
    baseTags: candidate.tags ?? [],
    handle,
    vendor,
    productType,
    title: normalize(candidate.title),
  })

  const handleScore = getEffectiveScore(profile.signals.byProductHandle[handle], now)
  const vendorScore = getEffectiveScore(profile.signals.byVendor[vendor], now)
  const productTypeScore = getEffectiveScore(profile.signals.byProductType[productType], now)
  const tagScore = tags.reduce((sum, tag) => sum + getEffectiveScore(profile.signals.byTag[tag], now), 0)
  const intelligence = getCachedProductIntelligence(candidate)
  const categoryScore = getEffectiveScore(profile.signals.byCategory[intelligence.primaryCategory], now)
  const materialScore = intelligence.materialTokens.reduce(
    (sum, token) => sum + getEffectiveScore(profile.signals.byMaterial[token], now),
    0,
  )
  const fitScore = intelligence.fitTokens.reduce(
    (sum, token) => sum + getEffectiveScore(profile.signals.byFit[token], now),
    0,
  )
  return (
    handleScore * 2 +
    vendorScore * 1.4 +
    productTypeScore * 1.1 +
    tagScore * 0.8 +
    categoryScore * 1.2 +
    materialScore * 0.7 +
    fitScore * 0.65
  )
}

function overlapScore(a: string[], b: string[], weight: number, cap: number): number {
  if (!a.length || !b.length) return 0
  const setB = new Set(b.map(normalize).filter(Boolean))
  let overlap = 0
  for (const entry of a) {
    if (setB.has(normalize(entry))) overlap += 1
  }
  return Math.min(cap, overlap * weight)
}

function overlapCount(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const setB = new Set(b.map(normalize).filter(Boolean))
  let overlap = 0
  for (const entry of a) {
    if (setB.has(normalize(entry))) overlap += 1
  }
  return overlap
}

function getSeedSimilarityScore(seed: ForYouCandidate, seedTerms: string[], candidate: ForYouCandidate): number {
  const seedIntelligence = getCachedProductIntelligence(seed)
  const candidateIntelligence = getCachedProductIntelligence(candidate)

  let score = 0
  if (
    seedIntelligence.primaryCategory !== "unknown" &&
    seedIntelligence.primaryCategory === candidateIntelligence.primaryCategory
  ) {
    score += 10
  }
  if (
    seedIntelligence.subCategory &&
    candidateIntelligence.subCategory &&
    seedIntelligence.subCategory === candidateIntelligence.subCategory
  ) {
    score += 6
  }

  score += overlapScore(seedIntelligence.materialTokens, candidateIntelligence.materialTokens, 2, 4)
  score += overlapScore(seedIntelligence.fitTokens, candidateIntelligence.fitTokens, 1.5, 3)
  score += overlapScore(seedIntelligence.styleTokens, candidateIntelligence.styleTokens, 1.5, 3)
  score += overlapScore(seedIntelligence.colorTokens, candidateIntelligence.colorTokens, 1.1, 2)
  score += overlapScore(seedTerms, candidateIntelligence.normalizedTerms, 0.7, 5)

  if (normalize(seed.vendor) && normalize(seed.vendor) === normalize(candidate.vendor)) score += 3
  if (normalize(seed.productType) && normalize(seed.productType) === normalize(candidate.productType)) score += 3
  return score
}

function categoryDistance(seedCategory: PrimaryCategory, candidateCategory: PrimaryCategory): number {
  if (seedCategory === "unknown" || candidateCategory === "unknown") return 2
  if (seedCategory === candidateCategory) return 0
  const related: Record<PrimaryCategory, PrimaryCategory[]> = {
    bottoms_denim: ["bottoms_pants", "outerwear"],
    bottoms_pants: ["bottoms_denim", "outerwear"],
    tops_hoodies: ["tops_shirts", "outerwear"],
    tops_shirts: ["tops_hoodies", "outerwear"],
    outerwear: ["tops_hoodies", "tops_shirts", "bottoms_pants", "bottoms_denim"],
    underwear: ["bottoms_pants"],
    shoes: ["accessories", "bottoms_pants", "bottoms_denim"],
    accessories: ["shoes", "tops_shirts", "tops_hoodies"],
    unknown: [],
  }
  if (related[seedCategory]?.includes(candidateCategory)) return 1
  return 3
}

function seededJitter(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const normalized = (hash >>> 0) / 0xffffffff
  return (normalized - 0.5) * 0.1
}

export function rankForYouReelCandidates(
  seed: ForYouCandidate,
  candidates: ForYouCandidate[],
  profile: ForYouProfile,
  options: { seedTerms: string[]; seedPrimaryCategory: PrimaryCategory; page: number; includeDebug?: boolean } = {
    seedTerms: [],
    seedPrimaryCategory: "unknown",
    page: 0,
    includeDebug: false,
  },
): ReelRankedItem[] {
  const coldStart = Object.keys(profile.signals.byProductHandle).length <= 2
  const userAffinityMultiplier = coldStart ? 0.35 : 0.5
  const explorationMultiplier = coldStart ? 0.16 : 0.1

  return candidates
    .filter((candidate) => normalize(candidate.handle) && normalize(candidate.handle) !== normalize(seed.handle))
    .map((candidate) => {
      const seedIntelligence = getCachedProductIntelligence(seed)
      const candidateIntelligence = getCachedProductIntelligence(candidate)
      const seedSimilarity = getSeedSimilarityScore(seed, options.seedTerms, candidate)
      const userAffinity = getUserAffinityScore(profile, candidate)
      const createdAtTs = Date.parse(candidate.createdAt ?? "")
      const ageDays = Number.isFinite(createdAtTs)
        ? Math.max(0, (Date.now() - createdAtTs) / (24 * 60 * 60 * 1000))
        : 365
      const category = candidateIntelligence.primaryCategory as PrimaryCategory
      const distance = categoryDistance(options.seedPrimaryCategory, category)
      const freshness = 1 / (1 + ageDays / 28)
      const adjacentBonus = distance === 0 ? 1.1 : distance === 1 ? 0.72 : 0.22
      const exploration = freshness * adjacentBonus
      const categoryPenalty =
        options.seedPrimaryCategory !== "unknown" && category !== options.seedPrimaryCategory
          ? distance >= 3
            ? 6
            : 2.5
          : 0

      const baseScore =
        seedSimilarity + userAffinity * userAffinityMultiplier + exploration * explorationMultiplier - categoryPenalty
      const score = baseScore + seededJitter(`${seed.handle}|${candidate.handle}|${options.page}`)
      const out: ReelRankedItem = {
        ...candidate,
        __score: score,
        __category: category,
      }
      if (options.includeDebug) {
        const materialOverlap = overlapCount(seedIntelligence.materialTokens, candidateIntelligence.materialTokens)
        const fitOverlap = overlapCount(seedIntelligence.fitTokens, candidateIntelligence.fitTokens)
        const styleOverlap = overlapCount(seedIntelligence.styleTokens, candidateIntelligence.styleTokens)
        const normalizedOverlapCount = overlapCount(options.seedTerms, candidateIntelligence.normalizedTerms)
        out.__debug = {
          seedSimilarity,
          similarityScore: seedSimilarity,
          userAffinity,
          exploration,
          categoryPenalty,
          adjacentBonus,
          categoryMatch: seedIntelligence.primaryCategory === candidateIntelligence.primaryCategory,
          materialOverlap,
          fitOverlap,
          styleOverlap,
          normalizedOverlapCount,
          penaltyApplied: categoryPenalty,
        }
      }
      return out
    })
    .sort((a, b) => b.__score - a.__score)
}

export function dedupeForYouCandidates(candidates: ForYouCandidate[]): { items: ForYouCandidate[]; deduped: number } {
  const seen = new Set<string>()
  const out: ForYouCandidate[] = []
  let deduped = 0
  for (const candidate of candidates) {
    const key = normalize(candidate.handle) || normalize(candidate.id)
    if (!key) continue
    if (seen.has(key)) {
      deduped += 1
      continue
    }
    seen.add(key)
    out.push(candidate)
  }
  return { items: out, deduped }
}

async function getProfileBackfill(
  profile: ForYouProfile,
  locale: { country?: string; language?: string },
): Promise<ForYouCandidate[]> {
  const handles = Array.from(
    new Set([
      ...profile.signals.recentHandles,
      ...Object.entries(profile.signals.byProductHandle)
        .sort((a, b) => b[1].score - a[1].score)
        .map(([handle]) => handle),
    ]),
  ).slice(0, 8)
  if (!handles.length) return []
  const settled = await Promise.allSettled(handles.map((handle) => getProductByHandle(handle, locale)))
  const out: ForYouCandidate[] = []
  for (const entry of settled) {
    if (entry.status !== "fulfilled") continue
    const candidate = toCandidateFromProduct((entry.value as any)?.product)
    if (candidate) out.push(candidate)
  }
  return out
}

function applyEarlyCategoryGuard(
  ranked: ReelRankedItem[],
  seedCategory: PrimaryCategory,
  page: number,
  limit: number,
  includeDebug: boolean,
): { items: ReelRankedItem[]; prevented: number } {
  const out: ReelRankedItem[] = []
  let prevented = 0
  for (const item of ranked) {
    if (out.length >= limit) break
    if (
      seedCategory !== "unknown" &&
      page === 0 &&
      out.length < EARLY_CATEGORY_WINDOW &&
      item.__category !== seedCategory
    ) {
      prevented += 1
      const withPenalty = { ...item, __score: item.__score - 8 }
      if (includeDebug && withPenalty.__debug) {
        withPenalty.__debug = { ...withPenalty.__debug, categoryPenalty: withPenalty.__debug.categoryPenalty + 8 }
      }
      if (withPenalty.__score < -4) continue
      out.push(withPenalty)
      continue
    }
    out.push(item)
  }
  return { items: out, prevented }
}

export async function getForYouReelPage(args: {
  seedHandle: string
  cursor?: string | null
  pageSize?: number
  locale: { country?: string; language?: string }
  includeDebug?: boolean
  refreshKey?: number
  profile?: ForYouProfile | null
}): Promise<{
  items: ForYouCandidate[]
  cursor: string | null
  debug?: {
    poolSize: number
    source: Record<string, number>
    query: string
    rankMs: number
    categorySwitchPrevented: number
    sample?: { handle: string; score: number; category: PrimaryCategory; debug?: ReelRankDebug }[]
  }
}> {
  const startedAt = Date.now()
  const pageSize = Math.max(8, Math.min(24, args.pageSize ?? REEL_PAGE_DEFAULT))
  const includeDebug = Boolean(args.includeDebug && typeof __DEV__ !== "undefined" && __DEV__)
  const profile = normalizeForYouProfile(args.profile ?? (await getForYouProfile()))
  const gender = normalizeGender(profile.gender)
  const state = decodeReelCursor(args.cursor)

  const seedProductRes = await getProductByHandle(args.seedHandle, args.locale)
  const seedCandidate = toCandidateFromProduct(seedProductRes?.product)
  if (!seedCandidate) {
    return { items: [], cursor: null }
  }
  const seedTermsSet = getSeedTermSet({
    ...seedCandidate,
    descriptionHtml: (seedProductRes as any)?.product?.descriptionHtml ?? null,
    description: (seedProductRes as any)?.product?.description ?? null,
  })

  const sourceCounts: Record<string, number> = {
    recFetched: 0,
    recUsed: 0,
    searchFetched: 0,
    searchUsed: 0,
    collectionFetched: 0,
    collectionUsed: 0,
    profileFetched: 0,
    profileUsed: 0,
    deduped: 0,
  }

  const served = new Set(state.servedHandles.map(normalize))
  const rawCandidates: ForYouCandidate[] = []

  if (state.page === 0) {
    const rec = await getRecommendedProducts(
      { productHandle: seedCandidate.handle, productId: seedCandidate.id, intent: "RELATED" },
      args.locale,
    ).catch(() => ({ productRecommendations: [] as any[] }))
    const recItems = (rec.productRecommendations ?? []).map((entry) => asCandidate(entry as ProductSearchCandidate))
    sourceCounts.recFetched = recItems.length
    rawCandidates.push(...recItems)
  }

  const searchRes = await searchProductsByTerms(
    {
      terms: seedTermsSet.seedTerms.slice(0, 6),
      gender,
      productType: seedCandidate.productType ?? null,
      vendor: seedCandidate.vendor ?? null,
      first: Math.max(pageSize * 2, 24),
      after: state.searchAfter,
    },
    args.locale,
  ).catch(() => ({ items: [] as ProductSearchCandidate[], cursor: null, hasNext: false, query: "" }))
  sourceCounts.searchFetched = searchRes.items.length
  rawCandidates.push(...searchRes.items.map(asCandidate))

  const handles = await resolveForYouCollectionHandles(gender, args.locale.language)
  const collection = await getForYouCandidates({
    handles,
    locale: args.locale,
    poolSize: Math.min(REEL_POOL_TARGET, Math.max(80, pageSize * 8)),
    perPage: 36,
    cursor: state.collectionCursor,
  }).catch(() => ({ items: [] as ForYouCandidate[], nextCursor: undefined }))
  sourceCounts.collectionFetched = collection.items.length
  rawCandidates.push(...(collection.items as ForYouCandidate[]))

  const profileBackfill = await getProfileBackfill(profile, args.locale)
  sourceCounts.profileFetched = profileBackfill.length
  rawCandidates.push(...profileBackfill)

  const { items: deduped, deduped: dedupedCount } = dedupeForYouCandidates(
    rawCandidates.filter((candidate) => {
      const handle = normalize(candidate.handle)
      if (!handle || handle === normalize(seedCandidate.handle)) return false
      if (served.has(handle)) return false
      return true
    }),
  )
  sourceCounts.deduped = dedupedCount
  sourceCounts.recUsed = deduped.filter((entry) =>
    rawCandidates.slice(0, sourceCounts.recFetched).some((r) => normalize(r.handle) === normalize(entry.handle)),
  ).length
  sourceCounts.searchUsed = deduped.filter((entry) =>
    searchRes.items.some((r) => normalize(r.handle) === normalize(entry.handle)),
  ).length
  sourceCounts.collectionUsed = deduped.filter((entry) =>
    (collection.items as ForYouCandidate[]).some((r) => normalize(r.handle) === normalize(entry.handle)),
  ).length
  sourceCounts.profileUsed = deduped.filter((entry) =>
    profileBackfill.some((r) => normalize(r.handle) === normalize(entry.handle)),
  ).length
  fypLogOnce(`REEL_RETRIEVAL_COUNTS:${seedCandidate.handle}:${state.page}`, "REEL_RETRIEVAL_COUNTS", {
    recsCount: sourceCounts.recUsed,
    searchCount: sourceCounts.searchUsed,
    collectionBackfillCount: sourceCounts.collectionUsed,
    profileBackfillCount: sourceCounts.profileUsed,
    totalAfterDedupe: deduped.length,
  })
  fypTableOnce(
    `REEL_CANDIDATE_SAMPLE:${seedCandidate.handle}:${state.page}`,
    "REEL_CANDIDATE_SAMPLE",
    deduped.slice(0, 5).map((candidate) => ({
      handle: candidate.handle,
      productType: candidate.productType ?? "",
      tags: (candidate.tags ?? []).slice(0, 5),
    })),
  )
  setFypDebugPanelEntry("reelRetrievalCounts", {
    recsCount: sourceCounts.recUsed,
    searchCount: sourceCounts.searchUsed,
    collectionBackfillCount: sourceCounts.collectionUsed,
    profileBackfillCount: sourceCounts.profileUsed,
    totalAfterDedupe: deduped.length,
  })

  const ranked = rankForYouReelCandidates(seedCandidate, deduped, profile, {
    seedTerms: seedTermsSet.seedTerms,
    seedPrimaryCategory: seedTermsSet.seedPrimaryCategory,
    page: state.page,
    includeDebug,
  })
  const guarded = applyEarlyCategoryGuard(ranked, seedTermsSet.seedPrimaryCategory, state.page, pageSize, includeDebug)
  if (includeDebug) {
    const rows = ranked.slice(0, 10).map((item) => ({
      handle: item.handle,
      similarityScore: Number((item.__debug?.similarityScore ?? 0).toFixed(4)),
      categoryMatch: Boolean(item.__debug?.categoryMatch),
      materialOverlap: item.__debug?.materialOverlap ?? 0,
      fitOverlap: item.__debug?.fitOverlap ?? 0,
      styleOverlap: item.__debug?.styleOverlap ?? 0,
      normalizedOverlap: item.__debug?.normalizedOverlapCount ?? 0,
      penaltyApplied: Number((item.__debug?.penaltyApplied ?? 0).toFixed(4)),
    }))
    fypTableOnce(`REEL_SIMILARITY_TOP10:${seedCandidate.handle}:${state.page}`, "REEL_SIMILARITY_TOP10", rows)
    setFypDebugPanelEntry("reelSimilarityTop10", rows)
  }

  const pageItems = (state.page === 0 ? [seedCandidate, ...guarded.items] : guarded.items).slice(0, pageSize)
  for (const item of pageItems) served.add(normalize(item.handle))
  const nextState: ReelCursor = {
    page: state.page + 1,
    searchAfter: searchRes.hasNext ? searchRes.cursor : null,
    collectionCursor: collection.nextCursor ?? null,
    servedHandles: Array.from(served).slice(-MAX_SERVED_TRACK),
  }
  const rankMs = Date.now() - startedAt
  recordForYouTelemetryTiming("reel.rank", rankMs)
  incrementForYouTelemetryCounter("reel.categorySwitchPrevented", guarded.prevented)

  return {
    items: pageItems,
    cursor:
      nextState.searchAfter || nextState.collectionCursor || pageItems.length >= pageSize
        ? encodeReelCursor(nextState)
        : null,
    debug: includeDebug
      ? {
          poolSize: deduped.length,
          source: sourceCounts,
          query: searchRes.query,
          rankMs,
          categorySwitchPrevented: guarded.prevented,
          sample: guarded.items.slice(0, 10).map((entry) => ({
            handle: entry.handle,
            score: entry.__score,
            category: entry.__category,
            debug: entry.__debug,
          })),
        }
      : undefined,
  }
}
