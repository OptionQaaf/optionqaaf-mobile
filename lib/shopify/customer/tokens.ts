import { secureKv } from "@/lib/storage/secureKv"

import { getShopifyCustomerConfig, sanitizeShopDomain } from "./config"
import { getOpenIdConfig } from "./discovery"
import { AuthExpiredError } from "./errors"
import type { StoredCustomerSession } from "./types"

const STORAGE_KEY = "shopify.customer.tokens:v2"
const EXPIRY_GRACE_MS = 60 * 1000

let cachedSession: StoredCustomerSession | null | undefined
let refreshPromise: Promise<StoredCustomerSession> | null = null

function parseSession(raw: string): StoredCustomerSession | null {
  try {
    const parsed = JSON.parse(raw) as StoredCustomerSession
    if (!parsed || typeof parsed !== "object") return null
    if (!parsed.shopDomain || !parsed.accessToken || !parsed.graphqlEndpoint) return null
    return parsed
  } catch {
    return null
  }
}

async function readStoredSession(): Promise<StoredCustomerSession | null> {
  if (cachedSession !== undefined) return cachedSession
  const raw = await secureKv.get(STORAGE_KEY)
  if (!raw) {
    cachedSession = null
    return null
  }
  const parsed = parseSession(raw)
  if (!parsed) {
    await secureKv.del(STORAGE_KEY)
    cachedSession = null
    return null
  }
  cachedSession = parsed
  return parsed
}

async function writeSession(session: StoredCustomerSession | null) {
  cachedSession = session
  if (!session) {
    await secureKv.del(STORAGE_KEY)
    return
  }
  await secureKv.set(STORAGE_KEY, JSON.stringify(session))
}

export async function getStoredCustomerSession(): Promise<StoredCustomerSession | null> {
  return readStoredSession()
}

export async function setStoredCustomerSession(session: StoredCustomerSession | null): Promise<void> {
  await writeSession(session)
}

export async function updateStoredCustomerSession(
  updater: (current: StoredCustomerSession) => StoredCustomerSession,
): Promise<StoredCustomerSession | null> {
  const existing = await readStoredSession()
  if (!existing) return null
  const next = updater(existing)
  await writeSession(next)
  return next
}

export async function clearStoredCustomerSession(): Promise<void> {
  await writeSession(null)
}

function needsRefresh(session: StoredCustomerSession, forceRefresh?: boolean) {
  if (forceRefresh) return true
  if (!session.expiresAt) return false
  return session.expiresAt <= Date.now() + EXPIRY_GRACE_MS
}

export async function getValidAccessToken(
  rawShopDomain?: string,
  options?: { forceRefresh?: boolean },
): Promise<{ accessToken: string; session: StoredCustomerSession }> {
  const session = await readStoredSession()
  if (!session) {
    throw new AuthExpiredError("No customer session found")
  }

  const domain = sanitizeShopDomain(rawShopDomain || session.shopDomain)
  if (session.shopDomain !== domain) {
    throw new AuthExpiredError("Customer session does not match requested shop")
  }

  if (!needsRefresh(session, options?.forceRefresh)) {
    return { accessToken: session.accessToken, session }
  }

  if (!session.refreshToken) {
    await clearStoredCustomerSession()
    throw new AuthExpiredError("Session expired and refresh token unavailable")
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshed = await refreshAccessTokenInternal(session, domain)
        await writeSession(refreshed)
        return refreshed
      } catch (error) {
        await clearStoredCustomerSession()
        throw error
      } finally {
        refreshPromise = null
      }
    })()
  }

  const refreshedSession = await refreshPromise
  return { accessToken: refreshedSession.accessToken, session: refreshedSession }
}

async function refreshAccessTokenInternal(
  session: StoredCustomerSession,
  shopDomain: string,
): Promise<StoredCustomerSession> {
  const { clientId } = getShopifyCustomerConfig()
  const openId = await getOpenIdConfig(shopDomain, true)

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken!,
    client_id: clientId,
  })

  const response = await fetch(openId.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: params.toString(),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new AuthExpiredError(`Token refresh failed (${response.status})${detail ? `: ${detail}` : ""}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    id_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
  }

  if (!data.access_token) {
    throw new AuthExpiredError("Token refresh failed: missing access token")
  }

  const now = Date.now()
  return {
    ...session,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? session.refreshToken,
    idToken: data.id_token ?? session.idToken,
    scope: data.scope ?? session.scope,
    tokenType: data.token_type ?? session.tokenType,
    tokenEndpoint: openId.tokenEndpoint,
    logoutEndpoint: openId.endSessionEndpoint ?? session.logoutEndpoint,
    expiresAt: data.expires_in ? now + data.expires_in * 1000 : now + 60 * 60 * 1000,
  }
}

export async function setGraphqlEndpointForSession(graphqlEndpoint: string): Promise<void> {
  await updateStoredCustomerSession((current) => ({ ...current, graphqlEndpoint }))
}
