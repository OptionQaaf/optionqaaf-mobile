// features/account/oauth.ts
import { useCustomerSession } from "@/features/account/session"
import { ShopifyError } from "@/lib/shopify/client"
import { SHOPIFY_CUSTOMER_CLIENT_ID, SHOPIFY_CUSTOMER_SCOPES } from "@/lib/shopify/env"
import { generateHexStringAsync } from "expo-auth-session"
import * as Crypto from "expo-crypto"

// ---------- CONFIG ----------
const STORE_ID = "85072904499" // your store's numeric id
const AUTH_BASE = `https://shopify.com/authentication/${STORE_ID}/oauth`
const AUTHORIZATION_ENDPOINT = `${AUTH_BASE}/authorize`
const TOKEN_ENDPOINT = `${AUTH_BASE}/token`
const REVOCATION_ENDPOINT = `https://shopify.com/authentication/${STORE_ID}/logout`

// Headless Customer Account API requires this scheme redirect
function resolveRedirectUri() {
  return `shop.${STORE_ID}.app://callback`
}

// ---------- PKCE ----------
function b64url(v: string) {
  return v.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
async function createCodeChallenge(verifier: string) {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  })
  return b64url(digest)
}
function resolveLocale() {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale
    return loc ? loc.split("-")[0] : undefined
  } catch {
    return undefined
  }
}

// ---------- TYPES ----------
export type TokenResponse = {
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  id_token?: string
  token_type?: string
}
function computeExpiry(expiresIn?: number) {
  const s = typeof expiresIn === "number" && Number.isFinite(expiresIn) ? expiresIn : 0
  if (s <= 0) return undefined
  const buffer = Math.min(60, Math.floor(s * 0.1))
  return Date.now() + Math.max(0, s - buffer) * 1000
}
export type CustomerOAuthSession = {
  authorizeUrl: string
  redirectUri: string
  state: string
  codeVerifier: string
}

// ---------- AUTHORIZE ----------
export async function createCustomerOAuthSession(): Promise<CustomerOAuthSession> {
  if (!SHOPIFY_CUSTOMER_CLIENT_ID) throw new ShopifyError("Missing EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID")

  const redirectUri = resolveRedirectUri()
  const scopes = (SHOPIFY_CUSTOMER_SCOPES || "openid email customer-account-api:full")
    .split(/[\s,]+/)
    .filter(Boolean)
    .join(" ")
  const state = await generateHexStringAsync(16)
  const codeVerifier = await generateHexStringAsync(32)
  const codeChallenge = await createCodeChallenge(codeVerifier)
  const locale = resolveLocale()

  const params = new URLSearchParams({
    client_id: SHOPIFY_CUSTOMER_CLIENT_ID,
    redirect_uri: redirectUri, // MUST be scheme: shop.<id>.app://callback
    response_type: "code",
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })
  if (locale) params.set("locale", locale)

  return {
    authorizeUrl: `${AUTHORIZATION_ENDPOINT}?${params.toString()}`,
    redirectUri,
    state,
    codeVerifier,
  }
}

// ---------- TOKEN / REFRESH / REVOKE ----------
async function exchangeToken(body: Record<string, string>) {
  const redirectUri = resolveRedirectUri()
  const form = new URLSearchParams({
    client_id: SHOPIFY_CUSTOMER_CLIENT_ID!,
    redirect_uri: redirectUri, // IDENTICAL to authorize
    ...body,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })
  const payload = (await res.json()) as TokenResponse & { error?: string; error_description?: string }
  if (!res.ok) throw new ShopifyError(payload.error_description || payload.error || "Failed to authenticate")
  if (!payload.access_token) throw new ShopifyError("Authentication payload missing access token")
  return payload
}

export async function completeCustomerOAuthSession({
  code,
  state,
  expectedState,
  codeVerifier,
}: {
  code: string
  state?: string | null
  expectedState: string
  codeVerifier: string
}) {
  if (state !== expectedState) throw new ShopifyError("Authentication response invalid")

  const tokenPayload = await exchangeToken({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
  })

  const expiresAt = computeExpiry(tokenPayload.expires_in)
  useCustomerSession.getState().setSession({
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token,
    expiresAt,
    idToken: tokenPayload.id_token,
    scope: tokenPayload.scope,
  })
  return tokenPayload
}

let refreshPromise: Promise<TokenResponse | null> | null = null

export async function refreshCustomerAccessToken(force = false) {
  const st = useCustomerSession.getState()
  if (!st.refreshToken) return null
  if (refreshPromise && !force) return refreshPromise

  useCustomerSession.getState().markRefreshing(true)
  refreshPromise = (async () => {
    try {
      const p = await exchangeToken({ grant_type: "refresh_token", refresh_token: st.refreshToken! })
      const expiresAt = computeExpiry(p.expires_in)
      useCustomerSession.getState().setSession({
        accessToken: p.access_token,
        refreshToken: p.refresh_token ?? st.refreshToken,
        expiresAt,
        idToken: p.id_token ?? st.idToken,
        scope: p.scope ?? st.scope,
      })
      return p
    } catch (e) {
      useCustomerSession.getState().clear()
      throw e
    } finally {
      useCustomerSession.getState().markRefreshing(false)
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function ensureCustomerAccessToken() {
  const st = useCustomerSession.getState()
  if (!st.accessToken) return null
  if (!st.expiresAt) return st.accessToken
  if (st.expiresAt - Date.now() > 60 * 1000) return st.accessToken
  const p = await refreshCustomerAccessToken()
  return p?.access_token ?? useCustomerSession.getState().accessToken ?? null
}

export async function signOutCustomer({ revoke = false }: { revoke?: boolean } = {}) {
  const { accessToken, refreshToken } = useCustomerSession.getState()
  useCustomerSession.getState().clear()
  if (!revoke || (!accessToken && !refreshToken)) return

  try {
    const form = new URLSearchParams({
      client_id: SHOPIFY_CUSTOMER_CLIENT_ID ?? "",
      token: accessToken || refreshToken || "",
    })
    await fetch(REVOCATION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    })
  } catch (err) {
    if (__DEV__) console.warn("[auth] failed to revoke token", err)
  }
}
