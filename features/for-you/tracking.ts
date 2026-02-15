import {
  applyForYouEvent,
  createEmptyForYouProfile,
  normalizeForYouProfile,
  pruneForYouProfile,
  type TrackForYouEvent,
} from "@/features/for-you/profile"
import { forYouProfileStorageResolver } from "@/features/for-you/storage"

const FLUSH_DELAY_MS = 900

let pendingEvents: TrackForYouEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushInFlight: Promise<void> | null = null

export function trackForYouEvent(event: TrackForYouEvent): void {
  pendingEvents.push({ ...event, at: event.at ?? new Date().toISOString() })
  scheduleFlush()
}

export async function flushForYouTracking(): Promise<void> {
  if (flushInFlight) return flushInFlight
  if (!pendingEvents.length) return

  const events = pendingEvents
  pendingEvents = []

  flushInFlight = (async () => {
    const storage = forYouProfileStorageResolver()
    const { profile } = await storage.getProfile()
    let next = normalizeForYouProfile(profile ?? createEmptyForYouProfile())

    for (const event of events) {
      next = applyForYouEvent(next, event)
    }

    await storage.setProfile(pruneForYouProfile(next))
  })().finally(() => {
    flushInFlight = null
  })

  return flushInFlight
}

export async function clearPendingForYouTracking(): Promise<void> {
  pendingEvents = []
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushForYouTracking().catch(() => {})
  }, FLUSH_DELAY_MS)
}

export type { TrackForYouEvent }
