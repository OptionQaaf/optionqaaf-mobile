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

export const FYP_SETTINGS_KEY = "fyp_settings_v1"
export const FYP_TRACKING_KEY = "fyp_tracking_v1"

export const DEFAULT_FYP_SETTINGS: FypSettings = {
  gender: "unknown",
  updatedAt: 0,
}

export const DEFAULT_FYP_TRACKING_STATE: FypTrackingState = {
  products: {},
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
