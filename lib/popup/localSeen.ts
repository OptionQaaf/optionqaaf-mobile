import { kv } from "@/lib/storage/storage"

const SEEN_KEY_PREFIX = "popup:seen:"

function getSeenKey(viewerKey: string): string {
  return `${SEEN_KEY_PREFIX}${viewerKey}`
}

type SeenMap = Record<string, string>

async function readSeenMap(viewerKey: string): Promise<SeenMap> {
  const raw = await kv.get(getSeenKey(viewerKey))
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
    await kv.del(getSeenKey(viewerKey))
    return {}
  }
}

async function persistSeenMap(viewerKey: string, entries: SeenMap): Promise<void> {
  await kv.set(getSeenKey(viewerKey), JSON.stringify(entries))
}

export async function hasSeenPopup(viewerKey: string, popupId: string, updatedAt?: string): Promise<boolean> {
  if (!viewerKey || !popupId) return false
  const map = await readSeenMap(viewerKey)
  if (updatedAt) {
    return map[popupId] === updatedAt
  }
  return Boolean(map[popupId])
}

export async function markPopupSeen(viewerKey: string, popupId: string, updatedAt?: string): Promise<void> {
  if (!viewerKey || !popupId) return
  const map = await readSeenMap(viewerKey)
  const nextValue = updatedAt ?? map[popupId] ?? new Date().toISOString()
  if (map[popupId] === nextValue) return
  map[popupId] = nextValue
  await persistSeenMap(viewerKey, map)
}

export async function clearSeenForViewer(viewerKey: string): Promise<void> {
  if (!viewerKey) return
  await kv.del(getSeenKey(viewerKey))
}
