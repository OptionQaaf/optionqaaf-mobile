import { kv } from "@/lib/storage/mmkv"

const DEVICE_ID_KEY = "popup:device-id"
let cachedDeviceId: string | null = null

function generateDeviceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `device-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

export function ensureDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId
  const stored = kv.get(DEVICE_ID_KEY)
  if (stored) {
    cachedDeviceId = stored
    return stored
  }
  const next = generateDeviceId()
  kv.set(DEVICE_ID_KEY, next)
  cachedDeviceId = next
  return next
}

export function getViewerKey(customerId: string | null | undefined): string {
  if (customerId?.trim()) {
    return `user:${customerId.trim()}`
  }
  const deviceId = ensureDeviceId()
  return `device:${deviceId}`
}
