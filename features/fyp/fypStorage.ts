import { kv } from "@/lib/storage/mmkv"

export type Gender = "male" | "female" | "unknown"

export type FypSettings = {
  gender: Gender
  updatedAt: number
}

export type ProductAffinity = {
  handle: string
  score: number
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

export function readFypSettings(): FypSettings {
  const raw = kv.get(FYP_SETTINGS_KEY)
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

export function writeFypSettings(settings: FypSettings): void {
  kv.set(
    FYP_SETTINGS_KEY,
    JSON.stringify({
      gender: settings.gender,
      updatedAt: settings.updatedAt,
    }),
  )
}

export function clearFypSettings(): void {
  kv.del(FYP_SETTINGS_KEY)
}

export function readFypTrackingState(): FypTrackingState {
  const raw = kv.get(FYP_TRACKING_KEY)
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
      products[handle] = {
        handle,
        score: typeof affinity.score === "number" ? affinity.score : 0,
        lastInteractionAt: typeof affinity.lastInteractionAt === "number" ? affinity.lastInteractionAt : 0,
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

export function writeFypTrackingState(state: FypTrackingState): void {
  kv.set(
    FYP_TRACKING_KEY,
    JSON.stringify({
      products: state.products,
      updatedAt: state.updatedAt,
    }),
  )
}

export function clearFypTrackingState(): void {
  kv.del(FYP_TRACKING_KEY)
}
