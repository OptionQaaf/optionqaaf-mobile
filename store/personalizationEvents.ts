import {
  clearRecentlyViewedFromProfile,
  PERSONALIZATION_EVENTS_CAP,
  applyPersonalizationEvent,
  buildPersonalizationEvent,
  createEmptyPersonalizationProfile,
  mergePersonalizationProfiles,
  normalizePersonalizationProfile,
  prunePersonalizationProfile,
  type PersonalizationEvent,
  type PersonalizationEventType,
  type PersonalizationProfileV1,
} from "@/lib/personalization/events"
import { kv as asyncKv } from "@/lib/storage/storage"
import { kv } from "@/lib/storage/mmkv"
import { create } from "zustand"

type RecordEventInput = {
  type: PersonalizationEventType
  productId: string
  handle: string
  variantId?: string | null
  timestamp?: string
}

type PersonalizationEventsState = {
  profile: PersonalizationProfileV1
  events: PersonalizationEvent[]
  hasUnsyncedChanges: boolean
  lastSyncedAt: string | null
  recordEvent: (event: RecordEventInput) => void
  mergeProfile: (incoming: PersonalizationProfileV1 | null, options?: { markUnsynced?: boolean }) => void
  replaceProfile: (next: PersonalizationProfileV1, options?: { markUnsynced?: boolean }) => void
  prune: () => void
  markSynced: () => void
  getUnsyncedEventCount: () => number
  clearRecentlyViewedOnly: () => void
}

type PersistedState = {
  profile: PersonalizationProfileV1
  events: PersonalizationEvent[]
  hasUnsyncedChanges: boolean
  lastSyncedAt: string | null
}

const KEY = "personalization-events-v1"

function persist(payload: PersistedState) {
  const raw = JSON.stringify(payload)
  kv.set(KEY, raw)
  void asyncKv.set(KEY, raw).catch((error: unknown) => {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[personalization-events] failed async mirror persist", error)
    }
  })
}

function sanitizeEvents(input: unknown): PersonalizationEvent[] {
  if (!Array.isArray(input)) return []
  const out: PersonalizationEvent[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue
    const record = raw as Record<string, unknown>
    const built = buildPersonalizationEvent({
      type: record.type as PersonalizationEventType,
      productId: String(record.productId ?? ""),
      handle: String(record.handle ?? ""),
      variantId: typeof record.variantId === "string" ? record.variantId : null,
      timestamp: typeof record.timestamp === "string" ? record.timestamp : undefined,
      id: typeof record.id === "string" ? record.id : undefined,
    })
    if (!built) continue
    out.push(built)
    if (out.length >= PERSONALIZATION_EVENTS_CAP) break
  }
  return out
}

function emptyState(): PersistedState {
  return {
    profile: createEmptyPersonalizationProfile(),
    events: [],
    hasUnsyncedChanges: false,
    lastSyncedAt: null,
  }
}

function parsePersisted(raw: string | null | undefined): PersistedState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    const normalizedProfile = prunePersonalizationProfile(normalizePersonalizationProfile(parsed.profile ?? null))
    const normalizedEvents = sanitizeEvents(parsed.events ?? normalizedProfile.eventLog).slice(
      0,
      PERSONALIZATION_EVENTS_CAP,
    )

    return {
      profile: normalizedProfile,
      events: normalizedEvents,
      hasUnsyncedChanges: parsed.hasUnsyncedChanges === true,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
    }
  } catch {
    return null
  }
}

function loadInitial(): PersistedState {
  const fromSync = parsePersisted(kv.get(KEY))
  return fromSync ?? emptyState()
}

const initial = loadInitial()

function countUnsyncedEvents(events: PersonalizationEvent[], lastSyncedAt: string | null): number {
  if (!events.length) return 0
  if (!lastSyncedAt) return events.length

  const syncedTs = new Date(lastSyncedAt).getTime()
  if (!Number.isFinite(syncedTs)) return events.length

  let count = 0
  for (const event of events) {
    const eventTs = new Date(event.timestamp).getTime()
    if (Number.isFinite(eventTs) && eventTs > syncedTs) {
      count += 1
    }
  }
  return count
}

export const usePersonalizationEvents = create<PersonalizationEventsState>((set, get) => ({
  profile: initial.profile,
  events: initial.events,
  hasUnsyncedChanges: initial.hasUnsyncedChanges,
  lastSyncedAt: initial.lastSyncedAt,

  recordEvent: (input) => {
    const event = buildPersonalizationEvent(input)
    if (!event) return

    const current = get()
    const nextProfile = prunePersonalizationProfile(applyPersonalizationEvent(current.profile, event))
    const nextEvents = nextProfile.eventLog.slice(0, PERSONALIZATION_EVENTS_CAP)
    const next = {
      profile: nextProfile,
      events: nextEvents,
      hasUnsyncedChanges: true,
      lastSyncedAt: current.lastSyncedAt,
    }

    set(next)
    persist(next)
  },

  mergeProfile: (incoming, options) => {
    if (!incoming) return
    const current = get()
    const merged = prunePersonalizationProfile(mergePersonalizationProfiles(current.profile, incoming))
    const next = {
      profile: merged,
      events: merged.eventLog.slice(0, PERSONALIZATION_EVENTS_CAP),
      hasUnsyncedChanges: options?.markUnsynced ?? current.hasUnsyncedChanges,
      lastSyncedAt: current.lastSyncedAt,
    }
    set(next)
    persist(next)
  },

  replaceProfile: (nextProfile, options) => {
    const current = get()
    const normalized = prunePersonalizationProfile(normalizePersonalizationProfile(nextProfile))
    const next = {
      profile: normalized,
      events: normalized.eventLog.slice(0, PERSONALIZATION_EVENTS_CAP),
      hasUnsyncedChanges: options?.markUnsynced ?? current.hasUnsyncedChanges,
      lastSyncedAt: current.lastSyncedAt,
    }
    set(next)
    persist(next)
  },

  prune: () => {
    const current = get()
    const normalized = prunePersonalizationProfile(current.profile)
    const next = {
      profile: normalized,
      events: normalized.eventLog.slice(0, PERSONALIZATION_EVENTS_CAP),
      hasUnsyncedChanges: current.hasUnsyncedChanges,
      lastSyncedAt: current.lastSyncedAt,
    }
    set(next)
    persist(next)
  },

  markSynced: () => {
    const current = get()
    const next = {
      profile: current.profile,
      events: current.events,
      hasUnsyncedChanges: false,
      lastSyncedAt: new Date().toISOString(),
    }
    set(next)
    persist(next)
  },

  getUnsyncedEventCount: () => {
    const state = get()
    if (!state.hasUnsyncedChanges) return 0
    return countUnsyncedEvents(state.events, state.lastSyncedAt)
  },

  clearRecentlyViewedOnly: () => {
    const current = get()
    const cleared = prunePersonalizationProfile(clearRecentlyViewedFromProfile(current.profile))
    const next = {
      profile: cleared,
      events: cleared.eventLog.slice(0, PERSONALIZATION_EVENTS_CAP),
      hasUnsyncedChanges: true,
      lastSyncedAt: current.lastSyncedAt,
    }
    set(next)
    persist(next)
  },
}))

export function getPersonalizationEventsState() {
  return usePersonalizationEvents.getState()
}

async function hydratePersonalizationEventsFromAsyncStorage() {
  try {
    const raw = await asyncKv.get(KEY)
    const parsed = parsePersisted(raw)
    if (!parsed) return

    const current = usePersonalizationEvents.getState()
    const hasLocalData =
      current.events.length > 0 ||
      current.hasUnsyncedChanges ||
      Object.keys(current.profile.products).length > 0 ||
      current.profile.recent.viewedHandles.length > 0 ||
      current.profile.recent.addedToCartHandles.length > 0 ||
      current.profile.recent.wishlistedHandles.length > 0

    if (hasLocalData) return

    usePersonalizationEvents.setState(parsed)
    kv.set(KEY, JSON.stringify(parsed))
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[personalization-events] failed async hydration", error)
    }
  }
}

void hydratePersonalizationEventsFromAsyncStorage()
