import type { PopupPayload, StoredPopup } from "@/types/popup"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")
const ADMIN_SECRET = process.env.EXPO_PUBLIC_PUSH_ADMIN_SECRET

function buildHeaders(additional?: Record<string, string>) {
  const headers: Record<string, string> = {
    "x-admin-secret": ADMIN_SECRET ?? "",
  }
  if (additional) {
    Object.assign(headers, additional)
  }
  return headers
}

async function parseErrorResponse(res: Response): Promise<string> {
  const text = await res.text().catch(() => "")
  if (!text) return `Request failed with status ${res.status}`
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed?.error === "string" && parsed.error.trim()) {
      return parsed.error
    }
  } catch {
    // ignore JSON parse errors
  }
  return text
}

function requireConfig() {
  if (!WORKER_URL) {
    throw new Error("Push worker URL not configured")
  }
  if (!ADMIN_SECRET) {
    throw new Error("Admin secret not configured")
  }
}

export async function fetchAdminCurrentPopup(): Promise<StoredPopup | null> {
  requireConfig()
  const res = await fetch(`${WORKER_URL}/api/admin/popup/current`, {
    method: "GET",
    headers: buildHeaders(),
  })
  if (!res.ok) {
    if (res.status === 404) {
      console.warn("[popup admin] Current popup endpoint not found")
      return null
    }
    const message = await parseErrorResponse(res)
    throw new Error(message)
  }
  const payload = (await res.json()) as { popup: StoredPopup | null }
  return payload.popup ?? null
}

export async function setAdminCurrentPopup(popup: PopupPayload): Promise<void> {
  requireConfig()
  try {
    await clearAdminCurrentPopup()
  } catch (err) {
    console.warn("[popup admin] Failed to clear existing popup before saving", err)
  }
  const res = await fetch(`${WORKER_URL}/api/admin/popup/setCurrent`, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ popup }),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res)
    throw new Error(message)
  }
}

export async function clearAdminCurrentPopup(): Promise<void> {
  requireConfig()
  const res = await fetch(`${WORKER_URL}/api/admin/popup/clearCurrent`, {
    method: "POST",
    headers: buildHeaders(),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res)
    throw new Error(message)
  }
}
