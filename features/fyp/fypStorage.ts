import { kv } from "@/lib/storage/mmkv"
import { kv as asyncKv } from "@/lib/storage/storage"

export type Gender = "male" | "female" | "unknown"

export type FypSettings = {
  gender: Gender
  updatedAt: number
}

export type ProductAffinity = {
  handle: string
  rawScore: number
  viewCount: number
  addToCartCount: number
  firstInteractionAt: number
  lastInteractionAt: number
}

export type FypTrackingState = {
  products: Record<string, ProductAffinity>
  updatedAt: number
}

export type FypExposureBucket = {
  handles: string[]
  lastSeenAtByHandle: Record<string, number>
  newestCursor: string | null
  updatedAt: number
}

export type FypExposureState = {
  buckets: Record<Gender, FypExposureBucket>
  updatedAt: number
}

export const FYP_SETTINGS_KEY = "fyp_settings_v1"
export const FYP_TRACKING_KEY = "fyp_tracking_v1"
export const FYP_EXPOSURE_KEY = "fyp_exposure_v1"

export const DEFAULT_FYP_SETTINGS: FypSettings = {
  gender: "unknown",
  updatedAt: 0,
}

export const DEFAULT_FYP_TRACKING_STATE: FypTrackingState = {
  products: {},
  updatedAt: 0,
}

function createDefaultExposureBucket(): FypExposureBucket {
  return {
    handles: [],
    lastSeenAtByHandle: {},
    newestCursor: null,
    updatedAt: 0,
  }
}

export const DEFAULT_FYP_EXPOSURE_STATE: FypExposureState = {
  buckets: {
    male: createDefaultExposureBucket(),
    female: createDefaultExposureBucket(),
    unknown: createDefaultExposureBucket(),
  },
  updatedAt: 0,
}

function isGender(value: unknown): value is Gender {
  return value === "male" || value === "female" || value === "unknown"
}

export async function readFypSettings(): Promise<FypSettings> {
  const raw = await asyncKv.get(FYP_SETTINGS_KEY)
  if (!raw) return { ...DEFAULT_FYP_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<FypSettings>
    return {
      gender: isGender(parsed.gender) ? parsed.gender : "unknown",
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    }
  } catch {
    return { ...DEFAULT_FYP_SETTINGS }
  }
}

export async function writeFypSettings(settings: FypSettings): Promise<void> {
  await asyncKv.set(
    FYP_SETTINGS_KEY,
    JSON.stringify({
      gender: settings.gender,
      updatedAt: settings.updatedAt,
    }),
  )
}

export async function clearFypSettings(): Promise<void> {
  await asyncKv.del(FYP_SETTINGS_KEY)
}

export function readFypTrackingState(): FypTrackingState {
  const raw = kv.get(FYP_TRACKING_KEY)
  return parseFypTrackingStateRaw(raw)
}

function parseFypTrackingStateRaw(raw: string | null): FypTrackingState {
  if (!raw) return { ...DEFAULT_FYP_TRACKING_STATE }
  try {
    const parsed = JSON.parse(raw) as Partial<FypTrackingState>
    const parsedProducts = parsed.products ?? {}
    const products: Record<string, ProductAffinity> = {}

    for (const [key, value] of Object.entries(parsedProducts)) {
      if (!value || typeof value !== "object") continue
      const affinity = value as Partial<ProductAffinity>
      const handle = typeof affinity.handle === "string" ? affinity.handle.trim() : key.trim()
      if (!handle) continue
      const lastInteractionAt = typeof affinity.lastInteractionAt === "number" ? affinity.lastInteractionAt : 0
      products[handle] = {
        handle,
        rawScore: typeof affinity.rawScore === "number" ? affinity.rawScore : 0,
        viewCount: typeof affinity.viewCount === "number" ? affinity.viewCount : 0,
        addToCartCount: typeof affinity.addToCartCount === "number" ? affinity.addToCartCount : 0,
        firstInteractionAt: typeof affinity.firstInteractionAt === "number" ? affinity.firstInteractionAt : 0,
        lastInteractionAt,
      }
    }

    return {
      products,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    }
  } catch {
    return { ...DEFAULT_FYP_TRACKING_STATE }
  }
}

export async function readFypTrackingStateAsync(): Promise<FypTrackingState> {
  const fromMmkv = parseFypTrackingStateRaw(kv.get(FYP_TRACKING_KEY))
  if (Object.keys(fromMmkv.products).length > 0 || fromMmkv.updatedAt > 0) {
    return fromMmkv
  }
  const raw = await asyncKv.get(FYP_TRACKING_KEY)
  return parseFypTrackingStateRaw(raw)
}

export function writeFypTrackingState(state: FypTrackingState): void {
  const products = Object.fromEntries(
    Object.entries(state.products).map(([key, value]) => {
      const affinity = value as Partial<ProductAffinity>
      return [
        key,
        {
          handle: typeof affinity.handle === "string" ? affinity.handle : key,
          rawScore: typeof affinity.rawScore === "number" ? affinity.rawScore : 0,
          viewCount: typeof affinity.viewCount === "number" ? affinity.viewCount : 0,
          addToCartCount: typeof affinity.addToCartCount === "number" ? affinity.addToCartCount : 0,
          firstInteractionAt: typeof affinity.firstInteractionAt === "number" ? affinity.firstInteractionAt : 0,
          lastInteractionAt: typeof affinity.lastInteractionAt === "number" ? affinity.lastInteractionAt : 0,
        } satisfies ProductAffinity,
      ]
    }),
  )

  const payload = JSON.stringify({
    products,
    updatedAt: state.updatedAt,
  })

  kv.set(FYP_TRACKING_KEY, payload)
  void asyncKv.set(FYP_TRACKING_KEY, payload).catch(() => {})
}

export function clearFypTrackingState(): void {
  kv.del(FYP_TRACKING_KEY)
  void asyncKv.del(FYP_TRACKING_KEY).catch(() => {})
}

function normalizeExposureBucket(input: Partial<FypExposureBucket> | null | undefined): FypExposureBucket {
  const handles = Array.isArray(input?.handles)
    ? input.handles.map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : "")).filter(Boolean)
    : []
  const lastSeenAtByHandle: Record<string, number> = {}
  const rawLastSeen = input?.lastSeenAtByHandle ?? {}
  for (const [key, value] of Object.entries(rawLastSeen)) {
    const handle = key.trim().toLowerCase()
    if (!handle) continue
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue
    lastSeenAtByHandle[handle] = value
  }

  return {
    handles,
    lastSeenAtByHandle,
    newestCursor: typeof input?.newestCursor === "string" && input.newestCursor ? input.newestCursor : null,
    updatedAt: typeof input?.updatedAt === "number" && Number.isFinite(input.updatedAt) ? input.updatedAt : 0,
  }
}

function parseFypExposureStateRaw(raw: string | null): FypExposureState {
  if (!raw) return { ...DEFAULT_FYP_EXPOSURE_STATE }
  try {
    const parsed = JSON.parse(raw) as Partial<FypExposureState>
    const buckets = (parsed.buckets ?? {}) as Partial<Record<Gender, Partial<FypExposureBucket>>>
    return {
      buckets: {
        male: normalizeExposureBucket(buckets.male),
        female: normalizeExposureBucket(buckets.female),
        unknown: normalizeExposureBucket(buckets.unknown),
      },
      updatedAt: typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
    }
  } catch {
    return { ...DEFAULT_FYP_EXPOSURE_STATE }
  }
}

export function readFypExposureState(): FypExposureState {
  const raw = kv.get(FYP_EXPOSURE_KEY)
  return parseFypExposureStateRaw(raw)
}

export async function readFypExposureStateAsync(): Promise<FypExposureState> {
  const fromMmkv = parseFypExposureStateRaw(kv.get(FYP_EXPOSURE_KEY))
  if (fromMmkv.updatedAt > 0) return fromMmkv
  const raw = await asyncKv.get(FYP_EXPOSURE_KEY)
  return parseFypExposureStateRaw(raw)
}

export function writeFypExposureState(state: FypExposureState): void {
  const payload = JSON.stringify({
    buckets: {
      male: normalizeExposureBucket(state.buckets.male),
      female: normalizeExposureBucket(state.buckets.female),
      unknown: normalizeExposureBucket(state.buckets.unknown),
    },
    updatedAt: typeof state.updatedAt === "number" && Number.isFinite(state.updatedAt) ? state.updatedAt : Date.now(),
  })
  kv.set(FYP_EXPOSURE_KEY, payload)
  void asyncKv.set(FYP_EXPOSURE_KEY, payload).catch(() => {})
}

export function clearFypExposureState(): void {
  kv.del(FYP_EXPOSURE_KEY)
  void asyncKv.del(FYP_EXPOSURE_KEY).catch(() => {})
}
