import { PopupPayload } from "@/types/popup"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")

type FetchCurrentParams = {
  viewerKey: string
  appVersion?: string
}

export async function fetchCurrentPopup({ viewerKey, appVersion }: FetchCurrentParams): Promise<PopupPayload | null> {
  if (!WORKER_URL || !viewerKey) return null
  const params = new URLSearchParams({ viewerKey })
  if (appVersion) params.set("appVersion", appVersion)

  try {
    const res = await fetch(`${WORKER_URL}/api/popup/current?${params.toString()}`, { method: "GET" })
    if (!res.ok) return null
    const data = await res.json()
    return data?.popup ?? null
  } catch {
    return null
  }
}

export async function markPopupSeenRemote(popupId: string, viewerKey: string): Promise<void> {
  if (!WORKER_URL || !popupId || !viewerKey) return
  try {
    await fetch(`${WORKER_URL}/api/popup/seen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ popupId, viewerKey }),
    })
  } catch {
    // Swallow errors so popup flow is not blocked.
  }
}
