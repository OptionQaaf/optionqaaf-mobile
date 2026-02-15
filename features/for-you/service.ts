import {
  applyServedCooldown,
  createEmptyForYouProfile,
  getProfileHash,
  isColdStart,
  normalizeForYouProfile,
  normalizeGender,
  pruneForYouProfile,
  rankForYouCandidates,
  type ForYouCandidate,
  type ForYouGender,
  type ForYouProfile,
  type RankedForYouItem,
} from "@/features/for-you/profile"
import { forYouProfileStorageResolver, resolveForYouIdentity } from "@/features/for-you/storage"
import { LocalForYouProfileStorage } from "@/features/for-you/storage/localStorage"
import { ShopifyMetafieldForYouProfileStorage } from "@/features/for-you/storage/shopifyMetafieldStorage"
import { getProductByHandle } from "@/lib/shopify/services/products"
import { isOnboardingDone } from "@/lib/storage/flags"
import { decodeForYouCursor, getForYouCandidates } from "@/lib/shopify/services/forYou"
import { getMobileHome, normalizeHome } from "@/lib/shopify/services/home"

const DEFAULT_POOL_SIZE = 200
const DEFAULT_PAGE_SIZE = 40

const GENDER_COLLECTION_CANDIDATES: Record<ForYouGender, string[]> = {
  male: ["men-1", "men"],
  female: ["women-1", "women"],
  unknown: ["men-1", "men", "women-1", "women"],
}

const FALLBACK_COLLECTION_HANDLES = ["new-arrivals", "new-in", "all", "all-products"]
const MEN_TAG = "men"
const WOMEN_TAG = "women"

export async function getForYouProfile(): Promise<ForYouProfile> {
  const storage = forYouProfileStorageResolver()
  const { profile } = await storage.getProfile()
  return normalizeForYouProfile(profile ?? createEmptyForYouProfile())
}

export async function saveForYouProfile(profile: ForYouProfile): Promise<void> {
  const storage = forYouProfileStorageResolver()
  await storage.setProfile(pruneForYouProfile(normalizeForYouProfile(profile)))
}

export async function resetForYouProfile(): Promise<void> {
  const storage = forYouProfileStorageResolver()
  await storage.resetProfile()
}

export async function getGender(): Promise<ForYouGender> {
  const profile = await getForYouProfile()
  return normalizeGender(profile.gender)
}

export async function setGender(gender: ForYouGender): Promise<ForYouProfile> {
  const profile = await getForYouProfile()
  const next = normalizeForYouProfile({
    ...profile,
    gender,
    updatedAt: new Date().toISOString(),
  })
  await saveForYouProfile(next)
  return next
}

export async function ensureForYouProfileOnLogin(): Promise<ForYouProfile> {
  const storage = forYouProfileStorageResolver()
  const localStorage = new LocalForYouProfileStorage()
  const remoteStorage = new ShopifyMetafieldForYouProfileStorage()
  const { profile, identity } = await storage.getProfile()
  const guestProfile = await localStorage.getProfile()

  const current = normalizeForYouProfile(profile ?? createEmptyForYouProfile())
  const guest = guestProfile ? normalizeForYouProfile(guestProfile) : null

  const next = normalizeForYouProfile({
    ...(guest ?? current),
    ...current,
    gender: normalizeGender(current.gender) === "unknown" ? normalizeGender(guest?.gender) : normalizeGender(current.gender),
    updatedAt: new Date().toISOString(),
  })

  let remoteHasProfile = false
  if (identity.isAuthenticated && identity.customerId) {
    try {
      const remote = await remoteStorage.getProfile()
      remoteHasProfile = Boolean(remote?.profile)
    } catch {
      remoteHasProfile = false
    }
  }

  const shouldPersist =
    identity.isAuthenticated &&
    Boolean(identity.customerId) &&
    (!remoteHasProfile ||
      !profile ||
      typeof (profile as ForYouProfile).gender !== "string" ||
      normalizeGender(next.gender) !== normalizeGender(current.gender))

  if (shouldPersist) {
    await saveForYouProfile(next)
    return next
  }

  return current
}

export async function needsGenderPrompt(profile?: ForYouProfile | null): Promise<boolean> {
  const done = await isOnboardingDone()
  if (!done) return false
  const resolved = normalizeForYouProfile(profile ?? (await getForYouProfile()))
  return normalizeGender(resolved.gender) === "unknown"
}

export async function resolveForYouCollectionHandles(gender: ForYouGender, language?: string): Promise<string[]> {
  const known = new Set<string>(
    gender === "male" || gender === "female" ? GENDER_COLLECTION_CANDIDATES[gender] : GENDER_COLLECTION_CANDIDATES.unknown,
  )

  try {
    const home = normalizeHome(await getMobileHome("app-home", language))
    for (const section of home.sections) {
      if (section.kind !== "product_rail") continue
      const handle = section.collectionHandle?.trim()
      if (handle) known.add(handle)
    }
  } catch {
    // Home-based fallback is optional.
  }

  for (const handle of FALLBACK_COLLECTION_HANDLES) {
    known.add(handle)
  }

  return Array.from(known)
}

export async function getForYouStorageDebugSnapshot(): Promise<{
  identity: { customerId: string | null; isAuthenticated: boolean }
  customerMetafieldHasProfile: boolean
  customerMetafieldStatus: "present" | "missing" | "read_error"
  customerMetafieldError: string | null
  customerMetafieldRawValue: string | null
  localGuestHasProfile: boolean
  localCustomerHasProfile: boolean
  resolvedProfileGender: ForYouGender
  remoteProfile: ForYouProfile | null
  localGuestProfile: ForYouProfile | null
  localCustomerProfile: ForYouProfile | null
  resolvedProfile: ForYouProfile | null
}> {
  const identity = await resolveForYouIdentity(true)
  const localStorage = new LocalForYouProfileStorage()
  const remoteStorage = new ShopifyMetafieldForYouProfileStorage()
  const storage = forYouProfileStorageResolver()

  const localGuest = await localStorage.getProfile()
  const localCustomer = identity.customerId ? await localStorage.getProfile({ customerId: identity.customerId }) : null

  let customerMetafieldHasProfile = false
  let remoteProfile: ForYouProfile | null = null
  let customerMetafieldStatus: "present" | "missing" | "read_error" = "missing"
  let customerMetafieldError: string | null = null
  let customerMetafieldRawValue: string | null = null
  if (identity.isAuthenticated && identity.customerId) {
    const remoteDebug = await remoteStorage.getDebugMetafieldState()
    customerMetafieldStatus = remoteDebug.status
    customerMetafieldError = remoteDebug.error
    customerMetafieldRawValue = remoteDebug.rawValue
    remoteProfile = remoteDebug.parsedProfile
    customerMetafieldHasProfile = Boolean(remoteProfile)
  }

  const resolved = await storage.getProfile()
  const resolvedProfile = resolved.profile ? normalizeForYouProfile(resolved.profile) : null
  return {
    identity,
    customerMetafieldHasProfile,
    customerMetafieldStatus,
    customerMetafieldError,
    customerMetafieldRawValue,
    localGuestHasProfile: Boolean(localGuest),
    localCustomerHasProfile: Boolean(localCustomer),
    resolvedProfileGender: normalizeGender(resolved.profile?.gender),
    remoteProfile,
    localGuestProfile: localGuest ? normalizeForYouProfile(localGuest) : null,
    localCustomerProfile: localCustomer ? normalizeForYouProfile(localCustomer) : null,
    resolvedProfile,
  }
}

export async function getForYouProducts(input: {
  pageSize?: number
  cursor?: string | null
  poolSize?: number
  refreshKey?: number
  locale: { country?: string; language?: string }
  includeDebug?: boolean
}): Promise<{
  items: ForYouCandidate[]
  nextCursor?: string
  profileHash: string
  gender: ForYouGender
  debug?: {
    candidateCount: number
    handleCount: number
  }
}> {
  const profile = await getForYouProfile()
  const gender = normalizeGender(profile.gender)
  const handles = await resolveForYouCollectionHandles(gender, input.locale.language)

  const candidatesResponse = await getForYouCandidates({
    handles,
    locale: input.locale,
    poolSize: input.poolSize ?? DEFAULT_POOL_SIZE,
    perPage: DEFAULT_PAGE_SIZE,
    cursor: input.cursor,
  })
  const profileHandleCandidates = await getProfileHandleCandidates(profile, input.locale)

  const candidatesRaw = dedupeCandidatesById([
    ...profileHandleCandidates,
    ...(candidatesResponse.items as ForYouCandidate[]),
  ])
  const strictCandidates =
    gender === "unknown" ? candidatesRaw : candidatesRaw.filter((candidate) => matchesGenderPool(candidate, gender))
  const candidates =
    gender === "unknown" || strictCandidates.length > 0
      ? strictCandidates
      : candidatesRaw.filter((candidate) => matchesGenderPoolLoose(candidate, gender))
  const pageDepth = input.cursor ? decodeForYouCursor(input.cursor, handles).page : 0
  const explorationRatio = getExplorationRatio(pageDepth)
  const dayRefreshKey = `${new Date().toISOString().slice(0, 10)}|${input.refreshKey ?? 0}`
  const refreshRound = Math.max(0, input.refreshKey ?? 0)
  const rankInputCandidates = applyRefreshNoveltyWindow(candidates, profile, {
    pageDepth,
    refreshRound,
    pageSize: input.pageSize ?? 40,
  })
  const ranked = isColdStart(profile)
    ? rankColdStartCandidates(rankInputCandidates, {
        limit: Math.max(10, Math.min(80, input.pageSize ?? 40)),
        profileUpdatedAt: `${profile.updatedAt}|${dayRefreshKey}`,
      })
    : rankForYouCandidates(profile, rankInputCandidates, {
        limit: Math.max(60, Math.min(200, (input.pageSize ?? 40) * 3)),
        pageDepth,
        explorationRatio,
        dateKey: dayRefreshKey,
      })

  const items = ranked.map(stripRank)
  const cooledProfile = applyServedCooldown(
    profile,
    ranked.map((item) => item.handle),
  )
  await saveForYouProfile(cooledProfile)

  const response: {
    items: ForYouCandidate[]
    nextCursor?: string
    profileHash: string
    gender: ForYouGender
    debug?: { candidateCount: number; handleCount: number }
  } = {
    items,
    nextCursor: candidatesResponse.nextCursor,
    profileHash: getProfileHash(cooledProfile),
    gender,
  }

  if (__DEV__ && input.includeDebug) {
    response.debug = {
      candidateCount: candidates.length,
      handleCount: handles.length,
    }
  }

  return response
}

function matchesGenderPool(candidate: ForYouCandidate, gender: ForYouGender): boolean {
  if (gender === "unknown") return true
  const tags = (candidate.tags ?? []).map((tag) => String(tag).trim().toLowerCase())
  const hasMen = tags.includes(MEN_TAG)
  const hasWomen = tags.includes(WOMEN_TAG)

  if (gender === "male") return hasMen && !hasWomen
  return hasWomen && !hasMen
}

function matchesGenderPoolLoose(candidate: ForYouCandidate, gender: ForYouGender): boolean {
  if (gender === "unknown") return true
  const tags = (candidate.tags ?? []).map((tag) => String(tag).trim().toLowerCase())
  const hasMen = tags.includes(MEN_TAG)
  const hasWomen = tags.includes(WOMEN_TAG)
  if (gender === "male") return !hasWomen
  return !hasMen
}

function stripRank(item: RankedForYouItem): ForYouCandidate {
  const { __score, ...rest } = item
  return rest
}

function rankColdStartCandidates(
  candidates: ForYouCandidate[],
  options: { limit: number; now?: number; profileUpdatedAt?: string } = { limit: 40 },
): RankedForYouItem[] {
  const now = options.now ?? Date.now()
  const dayKey = new Date(now).toISOString().slice(0, 10)
  const profileSeed = options.profileUpdatedAt ?? "unknown"

  return candidates
    .map((candidate) => {
      const ts = Date.parse((candidate as any).createdAt ?? "")
      const createdScore = Number.isFinite(ts) ? ts / 1e12 : 0
      const stockScore = candidate.availableForSale === false ? -1000 : 1000
      const jitter = coldStartJitter(`${profileSeed}|${dayKey}|${candidate.handle}`)
      return {
        ...candidate,
        __score: stockScore + createdScore + jitter,
      }
    })
    .sort((a, b) => b.__score - a.__score)
    .slice(0, options.limit)
}

function coldStartJitter(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = (h >>> 0) / 0xffffffff
  return (n - 0.5) * 0.2
}

function getExplorationRatio(pageDepth: number): number {
  if (pageDepth <= 0) return 0.08
  if (pageDepth === 1) return 0.14
  if (pageDepth === 2) return 0.2
  if (pageDepth === 3) return 0.27
  if (pageDepth === 4) return 0.34
  return 0.42
}

async function getProfileHandleCandidates(
  profile: ForYouProfile,
  locale: { country?: string; language?: string },
): Promise<ForYouCandidate[]> {
  const byScore = Object.entries(profile.signals.byProductHandle)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([handle]) => handle)
  const seedHandles = Array.from(new Set([...profile.signals.recentHandles, ...byScore])).slice(0, 16)
  if (!seedHandles.length) return []

  const settled = await Promise.allSettled(seedHandles.map((handle) => getProductByHandle(handle, locale)))
  const out: ForYouCandidate[] = []
  for (const result of settled) {
    if (result.status !== "fulfilled") continue
    const product = (result.value as any)?.product
    const candidate = toForYouCandidateFromProductDetail(product)
    if (candidate) out.push(candidate)
  }
  return out
}

function toForYouCandidateFromProductDetail(product: any): ForYouCandidate | null {
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
    productType: null,
    tags: null,
    createdAt: null,
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

function dedupeCandidatesById(candidates: ForYouCandidate[]): ForYouCandidate[] {
  const seen = new Set<string>()
  const out: ForYouCandidate[] = []
  for (const candidate of candidates) {
    const id = String(candidate?.id ?? "").trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(candidate)
  }
  return out
}

function applyRefreshNoveltyWindow(
  candidates: ForYouCandidate[],
  profile: ForYouProfile,
  input: { pageDepth: number; refreshRound: number; pageSize: number },
): ForYouCandidate[] {
  if (input.pageDepth !== 0 || input.refreshRound <= 0) return candidates

  const blockCount = Math.min(120, 24 + input.refreshRound * 10)
  const blocked = new Set(
    (profile.cooldowns?.recentlyServedHandles ?? [])
      .slice(0, blockCount)
      .map((handle) => normalizeHandle(handle))
      .filter(Boolean),
  )

  const fresh = candidates.filter((candidate) => !blocked.has(normalizeHandle(candidate.handle)))
  const minimumFresh = Math.max(12, Math.min(36, input.pageSize))
  if (fresh.length >= minimumFresh) return fresh

  return candidates
}

function normalizeHandle(handle?: string | null): string {
  if (typeof handle !== "string") return ""
  return handle.trim().toLowerCase()
}
