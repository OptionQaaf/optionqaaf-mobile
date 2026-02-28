import { create } from "zustand"
import {
  clearFypExposureState,
  DEFAULT_FYP_EXPOSURE_STATE,
  readFypExposureStateAsync,
  type FypExposureBucket,
  type Gender,
  writeFypExposureState,
} from "@/features/fyp/fypStorage"
import { createLogger } from "@/lib/diagnostics/logger"

const MAX_EXPOSED_HANDLES = 1200
const log = createLogger("fyp:exposure")

type FypExposureStore = {
  buckets: Record<Gender, FypExposureBucket>
  loadFromStorage: () => Promise<void>
  getSeenHandles: (gender: Gender) => string[]
  getNewestCursor: (gender: Gender) => string | null
  markServed: (gender: Gender, handles: string[]) => void
  setNewestCursor: (gender: Gender, cursor: string | null) => void
  reset: () => void
}

function normalizeHandle(input?: string | null): string {
  if (typeof input !== "string") return ""
  return input.trim().toLowerCase()
}

function persist(buckets: Record<Gender, FypExposureBucket>): void {
  writeFypExposureState({
    buckets,
    updatedAt: Date.now(),
  })
}

function trimExposureBucket(bucket: FypExposureBucket): FypExposureBucket {
  if (bucket.handles.length <= MAX_EXPOSED_HANDLES) return bucket
  const handles = bucket.handles.slice(bucket.handles.length - MAX_EXPOSED_HANDLES)
  const keep = new Set(handles)
  const lastSeenAtByHandle: Record<string, number> = {}
  for (const handle of handles) {
    const seenAt = bucket.lastSeenAtByHandle[handle]
    if (typeof seenAt === "number" && Number.isFinite(seenAt) && seenAt > 0) {
      lastSeenAtByHandle[handle] = seenAt
    }
  }
  for (const handle of Object.keys(bucket.lastSeenAtByHandle)) {
    if (!keep.has(handle)) continue
    lastSeenAtByHandle[handle] = bucket.lastSeenAtByHandle[handle]
  }
  return { ...bucket, handles, lastSeenAtByHandle }
}

export const useFypExposureStore = create<FypExposureStore>((set, get) => ({
  buckets: DEFAULT_FYP_EXPOSURE_STATE.buckets,
  loadFromStorage: async () => {
    const saved = await readFypExposureStateAsync()
    set({ buckets: saved.buckets })
    if (__DEV__) {
      log.debug("hydrate", {
        maleSeen: saved.buckets.male.handles.length,
        femaleSeen: saved.buckets.female.handles.length,
        unknownSeen: saved.buckets.unknown.handles.length,
      })
    }
    persist(saved.buckets)
  },
  getSeenHandles: (gender) => {
    return get().buckets[gender].handles
  },
  getNewestCursor: (gender) => {
    return get().buckets[gender].newestCursor
  },
  markServed: (gender, handles) => {
    const normalized = handles.map((entry) => normalizeHandle(entry)).filter(Boolean)
    if (!normalized.length) return
    set((state) => {
      const current = state.buckets[gender]
      const now = Date.now()
      const order = current.handles.slice()
      const lastSeenAtByHandle = { ...current.lastSeenAtByHandle }
      const inOrder = new Set(order)
      let newItems = 0
      let refreshedItems = 0

      for (const handle of normalized) {
        if (inOrder.has(handle)) {
          refreshedItems += 1
          order.splice(order.indexOf(handle), 1)
        } else {
          newItems += 1
        }
        inOrder.add(handle)
        order.push(handle)
        lastSeenAtByHandle[handle] = now
      }

      const nextBucket = trimExposureBucket({
        ...current,
        handles: order,
        lastSeenAtByHandle,
        updatedAt: now,
      })
      const buckets = { ...state.buckets, [gender]: nextBucket }
      persist(buckets)
      if (__DEV__) {
        log.debug("mark_served", {
          gender,
          received: normalized.length,
          newItems,
          refreshedItems,
          seenWindowSize: nextBucket.handles.length,
        })
      }
      return { buckets }
    })
  },
  setNewestCursor: (gender, cursor) => {
    set((state) => {
      const current = state.buckets[gender]
      if (current.newestCursor === cursor) return state
      const nextBucket: FypExposureBucket = {
        ...current,
        newestCursor: cursor,
        updatedAt: Date.now(),
      }
      const buckets = { ...state.buckets, [gender]: nextBucket }
      persist(buckets)
      return { buckets }
    })
  },
  reset: () => {
    clearFypExposureState()
    set({ buckets: DEFAULT_FYP_EXPOSURE_STATE.buckets })
  },
}))
