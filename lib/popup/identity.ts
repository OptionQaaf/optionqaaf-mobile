import { kv } from "@/lib/storage/storage"

const DEVICE_ID_KEY = "popup:device-id"
let cachedDeviceId: string | null = null

function generateDeviceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `device-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

export async function ensureDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId
  const stored = await kv.get(DEVICE_ID_KEY)
  if (stored) {
    cachedDeviceId = stored
    return stored
  }
  const next = generateDeviceId()
  await kv.set(DEVICE_ID_KEY, next)
  cachedDeviceId = next
  return next
}

export async function getViewerKey(customerId: string | null | undefined): Promise<string> {
  if (customerId?.trim()) {
    return `user:${customerId.trim()}`
  }
  const deviceId = await ensureDeviceId()
  return `device:${deviceId}`
}
