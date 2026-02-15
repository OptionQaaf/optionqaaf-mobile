import { fypTableOnce, setFypDebugPanelEntry } from "@/features/debug/fypDebug"

export type ForYouGender = "male" | "female" | "unknown"

export type ScoreEntry = {
  score: number
  lastAt: string
}

export type ScoreBucket = Record<string, ScoreEntry>

export type ForYouProfile = {
  schemaVersion: number
  updatedAt: string
  gender?: ForYouGender
  signals: {
    byProductHandle: ScoreBucket
    byVendor: ScoreBucket
    byProductType: ScoreBucket
    byTag: ScoreBucket
    byCategory: ScoreBucket
    byMaterial: ScoreBucket
    byFit: ScoreBucket
    recentHandles: string[]
  }
  cooldowns?: {
    recentlyServedHandles: string[]
  }
}

export type ForYouEventType =
  | "product_open"
  | "add_to_cart"
  | "add_to_wishlist"
  | "search_click"
  | "variant_select"
  | "pdp_scroll_75_percent"
  | "pdp_scroll_100_percent"
  | "time_on_product_>8s"

export type TrackForYouEvent = {
  type: ForYouEventType
  at?: string
  handle?: string | null
  vendor?: string | null
  productType?: string | null
  tags?: string[] | null
}

export type ForYouCandidate = {
  id: string
  handle: string
  title?: string | null
  vendor?: string | null
  productType?: string | null
  tags?: string[] | null
  createdAt?: string | null
  availableForSale?: boolean | null
  featuredImage?: {
    id?: string | null
    url?: string | null
    altText?: string | null
    width?: number | null
    height?: number | null
  } | null
  images?: {
    nodes?:
      | ({
          id?: string | null
          url?: string | null
          altText?: string | null
          width?: number | null
          height?: number | null
        } | null)[]
      | null
  } | null
  priceRange?: {
    minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null
    maxVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null
  } | null
  compareAtPriceRange?: {
    minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null
    maxVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null
  } | null
}

export type RankedForYouItem = ForYouCandidate & {
  __score: number
}

export const FOR_YOU_SCHEMA_VERSION = 2
export const FOR_YOU_RECENT_HANDLES_LIMIT = 50
export const FOR_YOU_RECENTLY_SERVED_LIMIT = 80
export const FOR_YOU_PROFILE_MAX_JSON_BYTES = 48 * 1024
const DEFAULT_HALF_LIFE_DAYS = 21
const MS_PER_DAY = 24 * 60 * 60 * 1000
const SIGNAL_TAG_LIMIT = 24
const SIGNAL_TAG_STOPWORDS = new Set([
  "and",
  "for",
  "with",
  "the",
  "this",
  "that",
  "from",
  "women",
  "woman",
  "female",
  "men",
  "man",
  "male",
  "unisex",
])

export const PDP_SCROLL_75_WEIGHT = 3.1
export const PDP_SCROLL_100_WEIGHT = 3.7
export const TIME_8S_WEIGHT = 3.3

const HANDLE_WEIGHT = {
  product_open: 2.5,
  add_to_cart: 4.5,
  add_to_wishlist: 4,
  search_click: 2,
  variant_select: 1,
  pdp_scroll_75_percent: PDP_SCROLL_75_WEIGHT,
  pdp_scroll_100_percent: PDP_SCROLL_100_WEIGHT,
  "time_on_product_>8s": TIME_8S_WEIGHT,
} as const

const VENDOR_WEIGHT = {
  product_open: 1.4,
  add_to_cart: 2.4,
  add_to_wishlist: 2.2,
  search_click: 1,
  variant_select: 0.6,
  pdp_scroll_75_percent: 0.9,
  pdp_scroll_100_percent: 1.1,
  "time_on_product_>8s": 1,
} as const

const PRODUCT_TYPE_WEIGHT = {
  product_open: 0.9,
  add_to_cart: 1.8,
  add_to_wishlist: 1.5,
  search_click: 0.8,
  variant_select: 0.5,
  pdp_scroll_75_percent: 0.6,
  pdp_scroll_100_percent: 0.8,
  "time_on_product_>8s": 0.75,
} as const

const TAG_WEIGHT = {
  product_open: 0.5,
  add_to_cart: 1.1,
  add_to_wishlist: 0.9,
  search_click: 0.5,
  variant_select: 0.3,
  pdp_scroll_75_percent: 0.35,
  pdp_scroll_100_percent: 0.45,
  "time_on_product_>8s": 0.4,
} as const

const CATEGORY_WEIGHT = {
  product_open: 1.25,
  add_to_cart: 2.5,
  add_to_wishlist: 2.1,
  search_click: 1.1,
  variant_select: 0.8,
  pdp_scroll_75_percent: 1.05,
  pdp_scroll_100_percent: 1.25,
  "time_on_product_>8s": 1.3,
} as const

const MATERIAL_WEIGHT = {
  product_open: 0.8,
  add_to_cart: 1.8,
  add_to_wishlist: 1.4,
  search_click: 0.7,
  variant_select: 0.55,
  pdp_scroll_75_percent: 0.65,
  pdp_scroll_100_percent: 0.75,
  "time_on_product_>8s": 0.85,
} as const

const FIT_WEIGHT = {
  product_open: 0.65,
  add_to_cart: 1.45,
  add_to_wishlist: 1.2,
  search_click: 0.55,
  variant_select: 0.5,
  pdp_scroll_75_percent: 0.5,
  pdp_scroll_100_percent: 0.62,
  "time_on_product_>8s": 0.72,
} as const

export function createEmptyForYouProfile(nowIso?: string): ForYouProfile {
  const now = nowIso ?? new Date().toISOString()
  return {
    schemaVersion: FOR_YOU_SCHEMA_VERSION,
    updatedAt: now,
    gender: "unknown",
    signals: {
      byProductHandle: {},
      byVendor: {},
      byProductType: {},
      byTag: {},
      byCategory: {},
      byMaterial: {},
      byFit: {},
      recentHandles: [],
    },
    cooldowns: {
      recentlyServedHandles: [],
    },
  }
}

export function normalizeForYouProfile(input: unknown, nowIso?: string): ForYouProfile {
  const base = createEmptyForYouProfile(nowIso)
  if (!input || typeof input !== "object") return base

  const raw = input as Partial<ForYouProfile>
  const normalized: ForYouProfile = {
    ...base,
    schemaVersion:
      Number(raw.schemaVersion) === FOR_YOU_SCHEMA_VERSION ? FOR_YOU_SCHEMA_VERSION : FOR_YOU_SCHEMA_VERSION,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
    gender: normalizeGender(raw.gender),
    signals: {
      byProductHandle: normalizeScoreBucket(raw.signals?.byProductHandle),
      byVendor: normalizeScoreBucket(raw.signals?.byVendor),
      byProductType: normalizeScoreBucket(raw.signals?.byProductType),
      byTag: normalizeScoreBucket(raw.signals?.byTag),
      byCategory: normalizeScoreBucket(raw.signals?.byCategory),
      byMaterial: normalizeScoreBucket(raw.signals?.byMaterial),
      byFit: normalizeScoreBucket(raw.signals?.byFit),
      recentHandles: normalizeRecentList(raw.signals?.recentHandles, FOR_YOU_RECENT_HANDLES_LIMIT),
    },
    cooldowns: {
      recentlyServedHandles: normalizeRecentList(raw.cooldowns?.recentlyServedHandles, FOR_YOU_RECENTLY_SERVED_LIMIT),
    },
  }

  return normalized
}

export function normalizeGender(gender?: string | null): ForYouGender {
  const value = String(gender ?? "unknown")
    .trim()
    .toLowerCase()
  if (value === "male" || value === "female") return value
  return "unknown"
}

export function getEffectiveScore(
  entry: ScoreEntry | undefined,
  now = Date.now(),
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
): number {
  if (!entry) return 0
  const rawScore = Number(entry.score)
  if (!Number.isFinite(rawScore) || rawScore <= 0) return 0

  const ts = Date.parse(entry.lastAt)
  if (!Number.isFinite(ts)) return rawScore

  const ageDays = Math.max(0, (now - ts) / MS_PER_DAY)
  const decay = Math.pow(0.5, ageDays / Math.max(1, halfLifeDays))
  return rawScore * decay
}

export function applyForYouEvent(profile: ForYouProfile, event: TrackForYouEvent, nowIso?: string): ForYouProfile {
  const now = nowIso ?? event.at ?? new Date().toISOString()
  const next: ForYouProfile = {
    ...profile,
    updatedAt: now,
    signals: {
      ...profile.signals,
      byProductHandle: { ...profile.signals.byProductHandle },
      byVendor: { ...profile.signals.byVendor },
      byProductType: { ...profile.signals.byProductType },
      byTag: { ...profile.signals.byTag },
      byCategory: { ...profile.signals.byCategory },
      byMaterial: { ...profile.signals.byMaterial },
      byFit: { ...profile.signals.byFit },
      recentHandles: [...profile.signals.recentHandles],
    },
    cooldowns: {
      recentlyServedHandles: [...(profile.cooldowns?.recentlyServedHandles ?? [])],
    },
  }

  const handle = normalizeKey(event.handle)
  const vendor = normalizeKey(event.vendor)
  const productType = normalizeKey(event.productType)
  const tags = deriveSignalTags({
    baseTags: event.tags,
    handle,
    vendor,
    productType,
  })
  const semantics = deriveEventSemantics({ tags, productType, handle, vendor })

  if (handle) {
    bumpScore(next.signals.byProductHandle, handle, HANDLE_WEIGHT[event.type], now)
    next.signals.recentHandles = pushRecent(next.signals.recentHandles, handle, FOR_YOU_RECENT_HANDLES_LIMIT)
  }

  if (vendor) {
    bumpScore(next.signals.byVendor, vendor, VENDOR_WEIGHT[event.type], now)
  }

  if (productType) {
    bumpScore(next.signals.byProductType, productType, PRODUCT_TYPE_WEIGHT[event.type], now)
  }

  if (tags.length) {
    for (const tag of tags) {
      bumpScore(next.signals.byTag, tag, TAG_WEIGHT[event.type], now)
    }
  }

  if (semantics.category && semantics.category !== "unknown") {
    bumpScore(next.signals.byCategory, semantics.category, CATEGORY_WEIGHT[event.type], now)
  }
  for (const material of semantics.materials) {
    bumpScore(next.signals.byMaterial, material, MATERIAL_WEIGHT[event.type], now)
  }
  for (const fit of semantics.fits) {
    bumpScore(next.signals.byFit, fit, FIT_WEIGHT[event.type], now)
  }

  return next
}

export function rankForYouCandidates(
  profile: ForYouProfile,
  candidates: ForYouCandidate[],
  options: { now?: number; limit?: number; dateKey?: string; explorationRatio?: number; pageDepth?: number } = {},
): RankedForYouItem[] {
  const now = options.now ?? Date.now()
  const limit = Math.max(1, options.limit ?? 40)
  const dayKey = options.dateKey ?? new Date(now).toISOString().slice(0, 10)
  const pageDepth = Math.max(0, options.pageDepth ?? 0)
  const explorationRatio = Math.max(0, Math.min(0.5, options.explorationRatio ?? 0))
  const recentServed = new Set(
    (profile.cooldowns?.recentlyServedHandles ?? []).map((h) => normalizeKey(h)).filter(Boolean),
  )
  const chosenVendorCounts = new Map<string, number>()

  const scored = candidates
    .filter((candidate) => Boolean(candidate?.handle))
    .map((candidate) => {
      const handle = normalizeKey(candidate.handle)
      const vendor = normalizeKey(candidate.vendor)
      const productType = normalizeKey(candidate.productType)
      const tags = deriveSignalTags({
        baseTags: candidate.tags,
        handle,
        vendor,
        productType,
        title: normalizeKey(candidate.title),
      })

      const handleScore = getEffectiveScore(profile.signals.byProductHandle[handle], now)
      const vendorScore = getEffectiveScore(profile.signals.byVendor[vendor], now)
      const productTypeScore = getEffectiveScore(profile.signals.byProductType[productType], now)
      const tagScore = tags.reduce((sum, tag) => sum + getEffectiveScore(profile.signals.byTag[tag], now), 0)
      const semantics = deriveEventSemantics({ tags, productType, handle, vendor })
      const categoryScore =
        semantics.category && semantics.category !== "unknown"
          ? getEffectiveScore(profile.signals.byCategory[semantics.category], now)
          : 0
      const materialScore = semantics.materials.reduce(
        (sum, material) => sum + getEffectiveScore(profile.signals.byMaterial[material], now),
        0,
      )

      const recentBoost = profile.signals.recentHandles.includes(handle) ? 1.25 : 0
      const personalizedScore =
        handleScore * 2.8 + vendorScore * 1.7 + productTypeScore * 1.3 + tagScore * 0.9 + recentBoost

      const familiarity = handleScore * 2.2 + vendorScore * 1.4 + productTypeScore + tagScore * 0.7
      const noveltyBoost = 1 / (1 + familiarity)
      const createdAtTs = Date.parse(candidate.createdAt ?? "")
      const ageDays = Number.isFinite(createdAtTs) ? Math.max(0, (now - createdAtTs) / MS_PER_DAY) : 365
      const freshnessBoost = 1 / (1 + ageDays / 20)
      const explorationScore = noveltyBoost * 3 + freshnessBoost * 1.6
      const depthAmplifier = 1 + Math.min(0.4, pageDepth * 0.04)
      const blendedScore =
        personalizedScore * (1 - explorationRatio) + explorationScore * explorationRatio * depthAmplifier

      const recentlyServedPenalty = recentServed.has(handle) ? 3 : 0
      const jitter = seededJitter(`${dayKey}|${profile.updatedAt}|${handle}`)

      return {
        ...candidate,
        __isRecentlyServed: recentServed.has(handle),
        __score: blendedScore - recentlyServedPenalty + jitter,
        __debug: {
          personalizedScore,
          explorationScore,
          blendedScore,
          categoryScore,
          materialScore,
        },
      }
    })
    .sort((a, b) => b.__score - a.__score)

  if (__DEV__) {
    const rows = scored.slice(0, 15).map((item) => ({
      handle: item.handle,
      personalizedScore: Number((item.__debug?.personalizedScore ?? 0).toFixed(4)),
      explorationScore: Number((item.__debug?.explorationScore ?? 0).toFixed(4)),
      blendedScore: Number((item.__debug?.blendedScore ?? item.__score).toFixed(4)),
      categoryScore: Number((item.__debug?.categoryScore ?? 0).toFixed(4)),
      materialScore: Number((item.__debug?.materialScore ?? 0).toFixed(4)),
    }))
    fypTableOnce(`GRID_RANK_TOP15:${dayKey}:${profile.updatedAt}`, "GRID_RANK_TOP15", rows)
    setFypDebugPanelEntry("gridRankTop15", rows)
  }

  const unseen = scored.filter((item) => !item.__isRecentlyServed)
  const seen = scored.filter((item) => item.__isRecentlyServed)
  const selectionPool = [...unseen, ...seen]

  const selected: (RankedForYouItem & { __isRecentlyServed?: boolean })[] = []
  const topVendorCounts = new Map<string, number>()
  for (const item of selectionPool) {
    const vendor = normalizeKey(item.vendor)
    const handle = normalizeKey(item.handle)
    const diversityKey = vendor || `h:${handle}`
    const seenCount = chosenVendorCounts.get(diversityKey) ?? 0
    const diversityPenalty = seenCount > 0 ? seenCount * 1.8 : 0
    const adjustedScore = item.__score - diversityPenalty
    if (selected.length >= limit) break
    if (selected.length < 12) {
      const vendorTopCount = topVendorCounts.get(diversityKey) ?? 0
      if (vendorTopCount >= 3) {
        continue
      }
      topVendorCounts.set(diversityKey, vendorTopCount + 1)
    }

    selected.push({ ...item, __score: adjustedScore })
    chosenVendorCounts.set(diversityKey, seenCount + 1)
  }

  return selected
    .map((item) => {
      const { __isRecentlyServed, ...rest } = item as any
      return rest as RankedForYouItem
    })
    .sort((a, b) => b.__score - a.__score)
}

export function isColdStart(profile: ForYouProfile, now = Date.now()): boolean {
  const handleScore = sumEffective(profile.signals.byProductHandle, now)
  const vendorScore = sumEffective(profile.signals.byVendor, now)
  const productTypeScore = sumEffective(profile.signals.byProductType, now)
  return handleScore < 0.1 && vendorScore < 0.1 && productTypeScore < 0.1
}

export function pruneForYouProfile(profile: ForYouProfile, now = Date.now()): ForYouProfile {
  const maxAge = 120 * MS_PER_DAY
  const oldestAllowed = now - maxAge
  const pruneBucket = (bucket: ScoreBucket): ScoreBucket => {
    const entries = Object.entries(bucket)
      .filter(([, value]) => {
        const ts = Date.parse(value.lastAt)
        if (!Number.isFinite(ts)) return false
        return ts >= oldestAllowed && value.score > 0
      })
      .sort((a, b) => getEffectiveScore(b[1], now) - getEffectiveScore(a[1], now))
      .slice(0, 100)
    return Object.fromEntries(entries)
  }

  const pruned = normalizeForYouProfile({
    ...profile,
    updatedAt: new Date(now).toISOString(),
    signals: {
      ...profile.signals,
      byProductHandle: pruneBucket(profile.signals.byProductHandle),
      byVendor: pruneBucket(profile.signals.byVendor),
      byProductType: pruneBucket(profile.signals.byProductType),
      byTag: pruneBucket(profile.signals.byTag),
      byCategory: pruneBucket(profile.signals.byCategory),
      byMaterial: pruneBucket(profile.signals.byMaterial),
      byFit: pruneBucket(profile.signals.byFit),
      recentHandles: profile.signals.recentHandles.slice(0, FOR_YOU_RECENT_HANDLES_LIMIT),
    },
    cooldowns: {
      recentlyServedHandles: (profile.cooldowns?.recentlyServedHandles ?? []).slice(0, FOR_YOU_RECENTLY_SERVED_LIMIT),
    },
  })

  return compactForYouProfileToSize(pruned, FOR_YOU_PROFILE_MAX_JSON_BYTES, now)
}

export function applyServedCooldown(profile: ForYouProfile, servedHandles: string[], nowIso?: string): ForYouProfile {
  const now = nowIso ?? new Date().toISOString()
  const nowMs = Date.parse(now)
  const next = normalizeForYouProfile(profile, now)
  const merged = [...servedHandles.map(normalizeKey).filter(Boolean), ...(next.cooldowns?.recentlyServedHandles ?? [])]
  next.cooldowns = {
    recentlyServedHandles: uniqueFirst(merged).slice(0, FOR_YOU_RECENTLY_SERVED_LIMIT),
  }
  next.updatedAt = now
  return pruneForYouProfile(next, Number.isFinite(nowMs) ? nowMs : Date.now())
}

export function getProfileHash(profile: ForYouProfile): string {
  const topKeys = (bucket: ScoreBucket) =>
    Object.entries(bucket)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 12)
      .map(([key]) => key)

  const payload = {
    gender: profile.gender,
    h: topKeys(profile.signals.byProductHandle),
    v: topKeys(profile.signals.byVendor),
    p: topKeys(profile.signals.byProductType),
    t: topKeys(profile.signals.byTag),
    c: topKeys(profile.signals.byCategory),
    m: topKeys(profile.signals.byMaterial),
    f: topKeys(profile.signals.byFit),
  }
  return simpleHash(JSON.stringify(payload))
}

function bumpScore(bucket: ScoreBucket, key: string, delta: number, nowIso: string) {
  if (!key || !Number.isFinite(delta) || delta <= 0) return
  const current = bucket[key]
  const nextScore = Math.min(500, Math.max(0, Number(current?.score ?? 0) + delta))
  bucket[key] = { score: nextScore, lastAt: nowIso }
}

function normalizeScoreBucket(bucket: unknown): ScoreBucket {
  if (!bucket || typeof bucket !== "object") return {}
  const next: ScoreBucket = {}
  for (const [rawKey, value] of Object.entries(bucket as Record<string, unknown>)) {
    const key = normalizeKey(rawKey)
    if (!key || !value || typeof value !== "object") continue
    const score = Number((value as ScoreEntry).score)
    const lastAt = (value as ScoreEntry).lastAt
    if (!Number.isFinite(score) || score <= 0) continue
    if (typeof lastAt !== "string" || !lastAt) continue
    next[key] = { score, lastAt }
  }
  return next
}

function normalizeRecentList(input: unknown, limit: number): string[] {
  if (!Array.isArray(input)) return []
  const normalized = input.map((item) => normalizeKey(item as string)).filter(Boolean) as string[]
  return uniqueFirst(normalized).slice(0, limit)
}

function normalizeKey(value?: string | null): string {
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase()
}

function tokenizeSignalText(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3 && !SIGNAL_TAG_STOPWORDS.has(entry) && !/^\d+$/.test(entry))
}

export function deriveSignalTags(input: {
  baseTags?: string[] | null
  handle?: string | null
  vendor?: string | null
  productType?: string | null
  title?: string | null
}): string[] {
  const out: string[] = []
  const push = (value?: string | null) => {
    const normalized = normalizeKey(value)
    if (!normalized) return
    out.push(normalized)
  }
  const pushTokens = (value?: string | null) => {
    const normalized = normalizeKey(value)
    if (!normalized) return
    const tokens = tokenizeSignalText(normalized)
    for (const token of tokens) out.push(token)
    for (let i = 0; i < tokens.length - 1; i += 1) {
      out.push(`${tokens[i]}_${tokens[i + 1]}`)
    }
  }

  for (const tag of input.baseTags ?? []) {
    push(tag)
    pushTokens(tag)
  }
  pushTokens(input.vendor)
  pushTokens(input.productType)
  pushTokens(input.title)
  pushTokens(input.handle)

  return uniqueFirst(out).slice(0, SIGNAL_TAG_LIMIT)
}

function pushRecent(list: string[], key: string, limit: number): string[] {
  const next = [key, ...list.filter((entry) => entry !== key)]
  return next.slice(0, limit)
}

function uniqueFirst(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    if (!item || seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

function seededJitter(seed: string): number {
  const hash = simpleHash(seed)
  const normalized = parseInt(hash.slice(0, 8), 16) / 0xffffffff
  return (normalized - 0.5) * 0.08
}

function sumEffective(bucket: ScoreBucket, now: number): number {
  return Object.values(bucket).reduce((sum, entry) => sum + getEffectiveScore(entry, now), 0)
}

function simpleHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function compactForYouProfileToSize(profile: ForYouProfile, maxBytes: number, now: number): ForYouProfile {
  let next = normalizeForYouProfile(profile, new Date(now).toISOString())
  if (measureProfileBytes(next) <= maxBytes) return next

  const caps = [80, 60, 40, 30, 20, 12, 8, 5, 3, 2, 1]
  for (const cap of caps) {
    next = normalizeForYouProfile({
      ...next,
      signals: {
        ...next.signals,
        byProductHandle: compactBucket(next.signals.byProductHandle, cap, now),
        byVendor: compactBucket(next.signals.byVendor, cap, now),
        byProductType: compactBucket(next.signals.byProductType, cap, now),
        byTag: compactBucket(next.signals.byTag, Math.max(1, Math.floor(cap * 0.6)), now),
        byCategory: compactBucket(next.signals.byCategory, Math.max(1, Math.floor(cap * 0.4)), now),
        byMaterial: compactBucket(next.signals.byMaterial, Math.max(1, Math.floor(cap * 0.4)), now),
        byFit: compactBucket(next.signals.byFit, Math.max(1, Math.floor(cap * 0.35)), now),
        recentHandles: next.signals.recentHandles.slice(0, Math.min(FOR_YOU_RECENT_HANDLES_LIMIT, cap)),
      },
      cooldowns: {
        recentlyServedHandles: (next.cooldowns?.recentlyServedHandles ?? []).slice(
          0,
          Math.min(FOR_YOU_RECENTLY_SERVED_LIMIT, cap * 2),
        ),
      },
    })
    if (measureProfileBytes(next) <= maxBytes) return next
  }

  next = normalizeForYouProfile({
    ...next,
    signals: {
      ...next.signals,
      byProductHandle: compactBucket(next.signals.byProductHandle, 1, now),
      byVendor: compactBucket(next.signals.byVendor, 1, now),
      byProductType: compactBucket(next.signals.byProductType, 1, now),
      byTag: {},
      byCategory: compactBucket(next.signals.byCategory, 1, now),
      byMaterial: compactBucket(next.signals.byMaterial, 1, now),
      byFit: compactBucket(next.signals.byFit, 1, now),
      recentHandles: next.signals.recentHandles.slice(0, 8),
    },
    cooldowns: {
      recentlyServedHandles: (next.cooldowns?.recentlyServedHandles ?? []).slice(0, 16),
    },
  })
  if (measureProfileBytes(next) <= maxBytes) return next

  return normalizeForYouProfile({
    ...createEmptyForYouProfile(new Date(now).toISOString()),
    gender: normalizeGender(profile.gender),
  })
}

function compactBucket(bucket: ScoreBucket, cap: number, now: number): ScoreBucket {
  const entries = Object.entries(bucket)
    .sort((a, b) => getEffectiveScore(b[1], now) - getEffectiveScore(a[1], now))
    .slice(0, Math.max(0, cap))
  return Object.fromEntries(entries)
}

function measureProfileBytes(profile: ForYouProfile): number {
  const json = JSON.stringify(profile)
  try {
    return new TextEncoder().encode(json).length
  } catch {
    return json.length
  }
}

function deriveEventSemantics(input: { tags: string[]; productType: string; handle: string; vendor: string }): {
  category: string
  materials: string[]
  fits: string[]
} {
  const tokens = new Set<string>()
  for (const entry of [...input.tags, input.productType, input.handle, input.vendor]) {
    for (const token of tokenizeSignalText(normalizeKey(entry))) {
      tokens.add(token)
    }
  }
  const hasAny = (...keys: string[]) => keys.some((key) => tokens.has(key))
  const category = hasAny("jeans", "denim")
    ? "bottoms_denim"
    : hasAny("boxer", "brief", "underwear")
      ? "underwear"
      : hasAny("hoodie", "sweatshirt", "pullover")
        ? "tops_hoodies"
        : hasAny("shirt", "tee", "blouse")
          ? "tops_shirts"
          : hasAny("jacket", "coat", "parka", "blazer")
            ? "outerwear"
            : hasAny("pants", "trouser", "cargo", "shorts", "skirt")
              ? "bottoms_pants"
              : hasAny("shoe", "sneaker", "boot", "loafer")
                ? "shoes"
                : hasAny("hat", "cap", "belt", "bag", "beret", "socks")
                  ? "accessories"
                  : "unknown"

  const materials = ["cotton", "denim", "polyester", "fleece", "wool"].filter((term) => tokens.has(term))
  const fits = ["slim", "regular", "oversized", "relaxed", "straight", "skinny"].filter((term) => tokens.has(term))

  return { category, materials, fits }
}
