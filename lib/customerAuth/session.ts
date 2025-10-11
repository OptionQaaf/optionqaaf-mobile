import { getCustomerAuthConfig } from "@/lib/config/customerAuth"
import { discoverOpenID, type OpenIdDiscoveryResult } from "@/lib/customerAuth/discovery"
import { OAuthTokens, performLogout as performRemoteLogout, refreshTokens } from "@/lib/customerAuth/oauth"
import { kv } from "@/lib/storage/mmkv"
import { secureKv } from "@/lib/storage/secureKv"

export type CustomerSession = {
  accessToken: string
  idToken?: string
  refreshToken?: string
  expiresAt: number
  scope?: string
  tokenType?: string
}

type SessionMeta = {
  savedAt: number
  discoverySource?: string
}

const SESSION_KEY = "customer-auth:session:v1"
const META_KEY = "customer-auth:session-meta:v1"

let inMemorySession: CustomerSession | null = null
let inMemoryMeta: SessionMeta | null = null
let openIdContext: OpenIdDiscoveryResult | null = null
let inflightRefresh: Promise<CustomerSession> | null = null

export function tokensToSession(tokens: OAuthTokens): CustomerSession {
  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    tokenType: tokens.tokenType,
  }
}

function readMeta(): SessionMeta | null {
  if (inMemoryMeta) return inMemoryMeta
  const raw = kv.get(META_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SessionMeta
    inMemoryMeta = parsed
    return parsed
  } catch {
    kv.del(META_KEY)
    return null
  }
}

export async function saveSession(session: CustomerSession, meta?: Partial<SessionMeta>): Promise<void> {
  inMemorySession = session
  await secureKv.set(SESSION_KEY, JSON.stringify(session))
  const record: SessionMeta = {
    savedAt: Date.now(),
    discoverySource: meta?.discoverySource ?? readMeta()?.discoverySource,
  }
  inMemoryMeta = record
  kv.set(META_KEY, JSON.stringify(record))
}

export async function loadSession(): Promise<CustomerSession | null> {
  if (inMemorySession) return inMemorySession
  const raw = await secureKv.get(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CustomerSession
    if (typeof parsed.expiresAt !== "number") {
      throw new Error("Invalid session payload")
    }
    inMemorySession = parsed
    return parsed
  } catch {
    await clearSession()
    return null
  }
}

export async function clearSession(): Promise<void> {
  inMemorySession = null
  inMemoryMeta = null
  openIdContext = null
  inflightRefresh = null
  await secureKv.del(SESSION_KEY)
  kv.del(META_KEY)
}

export function setDiscoverySource(source: string): void {
  const meta = readMeta() || { savedAt: Date.now() }
  meta.discoverySource = source
  inMemoryMeta = meta
  kv.set(META_KEY, JSON.stringify(meta))
}

export function isExpiringSoon(expiresAt: number, thresholdSec = 300): boolean {
  if (!expiresAt) return true
  return expiresAt - Date.now() <= thresholdSec * 1000
}

export async function getFreshAccessToken(thresholdSec = 300): Promise<string | null> {
  const session = await loadSession()
  if (!session) return null
  if (!session.expiresAt || !isExpiringSoon(session.expiresAt, thresholdSec)) {
    return session.accessToken
  }
  if (!session.refreshToken) {
    return null
  }

  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      const config = getCustomerAuthConfig()
      try {
        openIdContext = openIdContext ?? (await discoverOpenID(config.shopDomain))
        const tokens = await refreshTokens(session.refreshToken!, openIdContext)
        const nextSession = tokensToSession(tokens)
        await saveSession(nextSession)
        return nextSession
      } catch (error) {
        await clearSession()
        throw error
      } finally {
        inflightRefresh = null
      }
    })()
  }

  const refreshed = await inflightRefresh
  return refreshed.accessToken
}

export async function storeSessionFromTokens(tokens: OAuthTokens, discovery?: OpenIdDiscoveryResult): Promise<CustomerSession> {
  const session = tokensToSession(tokens)
  if (discovery) {
    openIdContext = discovery
    setDiscoverySource(discovery.source)
  }
  await saveSession(session)
  return session
}

export function getCachedSession(): CustomerSession | null {
  return inMemorySession
}

export async function ensureOpenId(): Promise<OpenIdDiscoveryResult> {
  if (openIdContext) return openIdContext
  const config = getCustomerAuthConfig()
  openIdContext = await discoverOpenID(config.shopDomain)
  return openIdContext
}

export async function logoutSession(): Promise<void> {
  try {
    const session = await loadSession()
    const openId = session ? await ensureOpenId() : null
    await performRemoteLogout(session?.idToken, openId ?? undefined)
  } finally {
    await clearSession()
  }
}
