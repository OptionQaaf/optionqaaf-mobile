export type PersonalizationEventType = "product_viewed" | "product_added_to_cart" | "product_added_to_wishlist"

export type PersonalizationEvent = {
  id: string
  type: PersonalizationEventType
  productId: string
  handle: string
  variantId?: string | null
  timestamp: string
}

export type PersonalizationProductCounts = {
  viewed: number
  addedToCart: number
  addedToWishlist: number
}

export type PersonalizationProductLast = {
  viewedAt: string | null
  addedToCartAt: string | null
  addedToWishlistAt: string | null
  lastEventAt: string | null
}

export type PersonalizationProductFacts = {
  productId: string
  handle: string
  counts: PersonalizationProductCounts
  last: PersonalizationProductLast
}

export type PersonalizationProfileV1 = {
  schemaVersion: 1
  rulesVersion: number
  updatedAt: string
  eventLog: PersonalizationEvent[]
  products: Record<string, PersonalizationProductFacts>
  recent: {
    viewedHandles: string[]
    addedToCartHandles: string[]
    wishlistedHandles: string[]
  }
}

export const PERSONALIZATION_SCHEMA_VERSION = 1
export const PERSONALIZATION_RULES_VERSION = 1
export const PERSONALIZATION_RETENTION_DAYS = 90
export const PERSONALIZATION_PRODUCTS_CAP = 200
export const PERSONALIZATION_RECENT_CAP = 50
export const PERSONALIZATION_EVENTS_CAP = 500
export const VIEW_EVENT_COOLDOWN_MS = 30_000

const EVENT_TYPES: PersonalizationEventType[] = ["product_viewed", "product_added_to_cart", "product_added_to_wishlist"]

const DEFAULT_COUNTS: PersonalizationProductCounts = {
  viewed: 0,
  addedToCart: 0,
  addedToWishlist: 0,
}

const DEFAULT_LAST: PersonalizationProductLast = {
  viewedAt: null,
  addedToCartAt: null,
  addedToWishlistAt: null,
  lastEventAt: null,
}

export function createEmptyPersonalizationProfile(nowIso = new Date().toISOString()): PersonalizationProfileV1 {
  return {
    schemaVersion: PERSONALIZATION_SCHEMA_VERSION,
    rulesVersion: PERSONALIZATION_RULES_VERSION,
    updatedAt: nowIso,
    eventLog: [],
    products: {},
    recent: {
      viewedHandles: [],
      addedToCartHandles: [],
      wishlistedHandles: [],
    },
  }
}

function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string") return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const next = value.trim()
  return next ? next : null
}

function normalizeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

function dedupeRecent(handles: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const handle of handles) {
    if (!handle || seen.has(handle)) continue
    seen.add(handle)
    out.push(handle)
    if (out.length >= PERSONALIZATION_RECENT_CAP) break
  }
  return out
}

function makeEventId(
  type: PersonalizationEventType,
  productId: string,
  timestamp: string,
  variantId?: string | null,
): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${type}:${productId}:${variantId ?? ""}:${timestamp}:${suffix}`
}

function sortEventsByNewest(events: PersonalizationEvent[]): PersonalizationEvent[] {
  return [...events].sort((a, b) => {
    const at = new Date(a.timestamp).getTime()
    const bt = new Date(b.timestamp).getTime()
    return bt - at
  })
}

function isPersonalizationEventType(value: unknown): value is PersonalizationEventType {
  return typeof value === "string" && EVENT_TYPES.includes(value as PersonalizationEventType)
}

function normalizeEvent(value: unknown): PersonalizationEvent | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const type = raw.type
  if (!isPersonalizationEventType(type)) return null

  const productId = normalizeNonEmptyString(raw.productId)
  const handle = normalizeNonEmptyString(raw.handle)
  const timestamp = normalizeIso(raw.timestamp)
  if (!productId || !handle || !timestamp) return null

  const variantId = normalizeNonEmptyString(raw.variantId)
  const id = normalizeNonEmptyString(raw.id) ?? makeEventId(type, productId, timestamp, variantId)

  return {
    id,
    type,
    productId,
    handle,
    variantId,
    timestamp,
  }
}

export function buildPersonalizationEvent(input: {
  type: PersonalizationEventType
  productId: string
  handle: string
  variantId?: string | null
  timestamp?: string
  id?: string
}): PersonalizationEvent | null {
  const productId = normalizeNonEmptyString(input.productId)
  const handle = normalizeNonEmptyString(input.handle)
  if (!productId || !handle) return null

  const timestamp = normalizeIso(input.timestamp) ?? new Date().toISOString()
  const variantId = normalizeNonEmptyString(input.variantId)

  return {
    id: normalizeNonEmptyString(input.id) ?? makeEventId(input.type, productId, timestamp, variantId),
    type: input.type,
    productId,
    handle,
    variantId,
    timestamp,
  }
}

function rebuildProfileFromEvents(eventsInput: PersonalizationEvent[], rulesVersion: number): PersonalizationProfileV1 {
  const events = sortEventsByNewest(eventsInput).slice(0, PERSONALIZATION_EVENTS_CAP)
  const products: Record<string, PersonalizationProductFacts> = {}

  const viewedHandles: string[] = []
  const cartHandles: string[] = []
  const wishlistHandles: string[] = []

  const seenViewed = new Set<string>()
  const seenCart = new Set<string>()
  const seenWishlist = new Set<string>()

  for (const event of events) {
    let facts = products[event.productId]
    if (!facts) {
      facts = {
        productId: event.productId,
        handle: event.handle,
        counts: { ...DEFAULT_COUNTS },
        last: { ...DEFAULT_LAST },
      }
      products[event.productId] = facts
    }

    facts.handle = event.handle
    facts.last.lastEventAt = maxIso(facts.last.lastEventAt, event.timestamp)

    if (event.type === "product_viewed") {
      facts.counts.viewed += 1
      facts.last.viewedAt = maxIso(facts.last.viewedAt, event.timestamp)
      if (!seenViewed.has(event.handle)) {
        seenViewed.add(event.handle)
        viewedHandles.push(event.handle)
      }
    }

    if (event.type === "product_added_to_cart") {
      facts.counts.addedToCart += 1
      facts.last.addedToCartAt = maxIso(facts.last.addedToCartAt, event.timestamp)
      if (!seenCart.has(event.handle)) {
        seenCart.add(event.handle)
        cartHandles.push(event.handle)
      }
    }

    if (event.type === "product_added_to_wishlist") {
      facts.counts.addedToWishlist += 1
      facts.last.addedToWishlistAt = maxIso(facts.last.addedToWishlistAt, event.timestamp)
      if (!seenWishlist.has(event.handle)) {
        seenWishlist.add(event.handle)
        wishlistHandles.push(event.handle)
      }
    }
  }

  const productEntries = Object.entries(products)
    .sort((a, b) => {
      const at = a[1].last.lastEventAt ? new Date(a[1].last.lastEventAt).getTime() : 0
      const bt = b[1].last.lastEventAt ? new Date(b[1].last.lastEventAt).getTime() : 0
      return bt - at
    })
    .slice(0, PERSONALIZATION_PRODUCTS_CAP)

  const limitedProducts = Object.fromEntries(productEntries)
  const allowedHandles = new Set(Object.values(limitedProducts).map((facts) => facts.handle))

  const limitedEvents = events.filter((event) => allowedHandles.has(event.handle)).slice(0, PERSONALIZATION_EVENTS_CAP)

  return {
    schemaVersion: PERSONALIZATION_SCHEMA_VERSION,
    rulesVersion,
    updatedAt: limitedEvents[0]?.timestamp ?? new Date().toISOString(),
    eventLog: limitedEvents,
    products: limitedProducts,
    recent: {
      viewedHandles: dedupeRecent(viewedHandles.filter((handle) => allowedHandles.has(handle))),
      addedToCartHandles: dedupeRecent(cartHandles.filter((handle) => allowedHandles.has(handle))),
      wishlistedHandles: dedupeRecent(wishlistHandles.filter((handle) => allowedHandles.has(handle))),
    },
  }
}

export function normalizePersonalizationProfile(input: unknown): PersonalizationProfileV1 {
  if (!input || typeof input !== "object") return createEmptyPersonalizationProfile()

  const raw = input as Record<string, unknown>
  const rulesVersion =
    typeof raw.rulesVersion === "number" && Number.isFinite(raw.rulesVersion) ? Math.floor(raw.rulesVersion) : 1

  const normalizedEvents = Array.isArray(raw.eventLog)
    ? raw.eventLog.map((event) => normalizeEvent(event)).filter((event): event is PersonalizationEvent => !!event)
    : []

  if (normalizedEvents.length > 0) {
    return rebuildProfileFromEvents(normalizedEvents, rulesVersion)
  }

  // Backward-compatible fallback from facts-only payloads
  const legacyProductsRaw =
    raw.products && typeof raw.products === "object" ? (raw.products as Record<string, unknown>) : {}
  const fallbackEvents: PersonalizationEvent[] = []

  for (const [key, value] of Object.entries(legacyProductsRaw)) {
    if (!value || typeof value !== "object") continue
    const factRaw = value as Record<string, unknown>
    const handle = normalizeNonEmptyString(factRaw.handle)
    const productId = normalizeNonEmptyString(factRaw.productId) ?? key
    if (!handle || !productId) continue

    const countsRaw = (factRaw.counts ?? {}) as Record<string, unknown>
    const lastRaw = (factRaw.last ?? {}) as Record<string, unknown>

    const viewed = normalizeCount(countsRaw.viewed)
    const addedToCart = normalizeCount(countsRaw.addedToCart)
    const addedToWishlist = normalizeCount(countsRaw.addedToWishlist)

    const viewedAt = normalizeIso(lastRaw.viewedAt)
    const addedToCartAt = normalizeIso(lastRaw.addedToCartAt)
    const addedToWishlistAt = normalizeIso(lastRaw.addedToWishlistAt)

    for (let i = 0; i < viewed; i++) {
      fallbackEvents.push({
        id: makeEventId("product_viewed", productId, viewedAt ?? new Date().toISOString()),
        type: "product_viewed",
        productId,
        handle,
        timestamp: viewedAt ?? new Date().toISOString(),
        variantId: null,
      })
    }

    for (let i = 0; i < addedToCart; i++) {
      fallbackEvents.push({
        id: makeEventId("product_added_to_cart", productId, addedToCartAt ?? new Date().toISOString()),
        type: "product_added_to_cart",
        productId,
        handle,
        timestamp: addedToCartAt ?? new Date().toISOString(),
        variantId: null,
      })
    }

    for (let i = 0; i < addedToWishlist; i++) {
      fallbackEvents.push({
        id: makeEventId("product_added_to_wishlist", productId, addedToWishlistAt ?? new Date().toISOString()),
        type: "product_added_to_wishlist",
        productId,
        handle,
        timestamp: addedToWishlistAt ?? new Date().toISOString(),
        variantId: null,
      })
    }
  }

  return rebuildProfileFromEvents(fallbackEvents, rulesVersion)
}

function shouldIgnoreEvent(profile: PersonalizationProfileV1, event: PersonalizationEvent): boolean {
  if (event.type !== "product_viewed") return false
  const facts = profile.products[event.productId]
  if (!facts?.last.viewedAt) return false
  const previous = new Date(facts.last.viewedAt).getTime()
  const current = new Date(event.timestamp).getTime()
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return false
  return current - previous < VIEW_EVENT_COOLDOWN_MS
}

export function applyPersonalizationEvent(
  profileInput: PersonalizationProfileV1,
  event: PersonalizationEvent,
): PersonalizationProfileV1 {
  const profile = normalizePersonalizationProfile(profileInput)
  if (profile.eventLog.some((entry) => entry.id === event.id)) return profile
  if (shouldIgnoreEvent(profile, event)) return profile

  const nextEvents = [event, ...profile.eventLog]
  return rebuildProfileFromEvents(nextEvents, profile.rulesVersion)
}

export function mergePersonalizationProfiles(
  leftInput: PersonalizationProfileV1 | null | undefined,
  rightInput: PersonalizationProfileV1 | null | undefined,
): PersonalizationProfileV1 {
  const left = normalizePersonalizationProfile(leftInput ?? createEmptyPersonalizationProfile())
  const right = normalizePersonalizationProfile(rightInput ?? createEmptyPersonalizationProfile())

  const eventMap = new Map<string, PersonalizationEvent>()
  for (const event of [...left.eventLog, ...right.eventLog]) {
    if (!eventMap.has(event.id)) {
      eventMap.set(event.id, event)
    }
  }

  return rebuildProfileFromEvents(Array.from(eventMap.values()), Math.max(left.rulesVersion, right.rulesVersion))
}

export function prunePersonalizationProfile(
  input: PersonalizationProfileV1,
  now = Date.now(),
  maxAgeDays = PERSONALIZATION_RETENTION_DAYS,
): PersonalizationProfileV1 {
  const profile = normalizePersonalizationProfile(input)
  const threshold = now - maxAgeDays * 24 * 60 * 60 * 1000

  const events = profile.eventLog.filter((event) => {
    const ts = new Date(event.timestamp).getTime()
    return Number.isFinite(ts) && ts >= threshold
  })

  return rebuildProfileFromEvents(events, profile.rulesVersion)
}

export function rankProductsFromProfile(
  profileInput: PersonalizationProfileV1,
  weights: { viewed: number; addedToCart: number; addedToWishlist: number } = {
    viewed: 1,
    addedToCart: 5,
    addedToWishlist: 3,
  },
): { productId: string; handle: string; score: number; lastEventAt: string | null }[] {
  const profile = normalizePersonalizationProfile(profileInput)

  return Object.values(profile.products)
    .map((facts) => ({
      productId: facts.productId,
      handle: facts.handle,
      score:
        facts.counts.viewed * weights.viewed +
        facts.counts.addedToCart * weights.addedToCart +
        facts.counts.addedToWishlist * weights.addedToWishlist,
      lastEventAt: facts.last.lastEventAt,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const at = a.lastEventAt ? new Date(a.lastEventAt).getTime() : 0
      const bt = b.lastEventAt ? new Date(b.lastEventAt).getTime() : 0
      return bt - at
    })
}

export function getRecentlyViewedOnlyHandles(
  profileInput: PersonalizationProfileV1,
  limit = PERSONALIZATION_RECENT_CAP,
): string[] {
  const profile = normalizePersonalizationProfile(profileInput)

  return Object.values(profile.products)
    .filter((facts) => facts.counts.viewed > 0 && facts.counts.addedToCart === 0 && facts.counts.addedToWishlist === 0)
    .sort((a, b) => {
      const at = a.last.viewedAt ? new Date(a.last.viewedAt).getTime() : 0
      const bt = b.last.viewedAt ? new Date(b.last.viewedAt).getTime() : 0
      return bt - at
    })
    .map((facts) => facts.handle)
    .filter((handle) => Boolean(handle))
    .slice(0, Math.max(1, limit))
}

export function clearRecentlyViewedOnlyFromProfile(profileInput: PersonalizationProfileV1): PersonalizationProfileV1 {
  const profile = normalizePersonalizationProfile(profileInput)
  const targets = new Set(
    Object.values(profile.products)
      .filter(
        (facts) => facts.counts.viewed > 0 && facts.counts.addedToCart === 0 && facts.counts.addedToWishlist === 0,
      )
      .map((facts) => facts.productId),
  )

  if (!targets.size) return profile

  const nextEvents = profile.eventLog.filter((event) => {
    if (!targets.has(event.productId)) return true
    return event.type !== "product_viewed"
  })

  return rebuildProfileFromEvents(nextEvents, profile.rulesVersion)
}
