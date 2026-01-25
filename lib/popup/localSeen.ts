import { kv } from "@/lib/storage/mmkv"

const SEEN_KEY_PREFIX = "popup:seen:"

function getSeenKey(viewerKey: string): string {
  return `${SEEN_KEY_PREFIX}${viewerKey}`
}

type SeenMap = Record<string, string>

function readSeenMap(viewerKey: string): SeenMap {
  const raw = kv.get(getSeenKey(viewerKey))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed)
          .filter(([key, value]) => typeof key === "string" && typeof value === "string")
          .map(([key, value]) => [key, value as string]),
      ) as SeenMap
    }
    throw new Error("Invalid seen map")
  } catch {
    kv.del(getSeenKey(viewerKey))
    return {}
  }
}

function persistSeenMap(viewerKey: string, entries: SeenMap) {
  kv.set(getSeenKey(viewerKey), JSON.stringify(entries))
}

export function hasSeenPopup(viewerKey: string, popupId: string, updatedAt?: string): boolean {
  if (!viewerKey || !popupId) return false
  const map = readSeenMap(viewerKey)
  if (updatedAt) {
    return map[popupId] === updatedAt
  }
  return Boolean(map[popupId])
}

export function markPopupSeen(viewerKey: string, popupId: string, updatedAt?: string) {
  if (!viewerKey || !popupId) return
  const map = readSeenMap(viewerKey)
  const nextValue = updatedAt ?? map[popupId] ?? new Date().toISOString()
  if (map[popupId] === nextValue) return
  map[popupId] = nextValue
  persistSeenMap(viewerKey, map)
}

export function clearSeenForViewer(viewerKey: string) {
  if (!viewerKey) return
  kv.del(getSeenKey(viewerKey))
}
