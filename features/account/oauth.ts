import { useCustomerSession } from "@/features/account/session"
import { ShopifyError } from "@/lib/shopify/client"
import { SHOPIFY_CUSTOMER_CLIENT_ID, SHOPIFY_CUSTOMER_REDIRECT_PATH, SHOPIFY_CUSTOMER_SCOPES } from "@/lib/shopify/env"
import { generateHexStringAsync, makeRedirectUri } from "expo-auth-session"
import * as Crypto from "expo-crypto"
import { Platform } from "react-native"

const AUTH_BASE = `https://shopify.com/auth/oauth`
const AUTHORIZATION_ENDPOINT = `${AUTH_BASE}/authorize`
const TOKEN_ENDPOINT = `${AUTH_BASE}/token`
const REVOCATION_ENDPOINT = `${AUTH_BASE}/revoke`

function resolveRedirectUri() {
  return makeRedirectUri({
    scheme: Platform.select({ web: undefined, default: "optionqaafmobile" }),
    path: SHOPIFY_CUSTOMER_REDIRECT_PATH,
  })
}

function base64UrlEncode(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function createCodeChallenge(verifier: string) {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  })
  return base64UrlEncode(digest)
}

function resolveLocale() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    if (!locale) return undefined
    const [language] = locale.split("-")
    return language
  } catch {
    return undefined
  }
}

export type TokenResponse = {
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  id_token?: string
  token_type?: string
}

function computeExpiry(expiresIn?: number) {
  const seconds = typeof expiresIn === "number" && Number.isFinite(expiresIn) ? expiresIn : 0
  if (seconds <= 0) return undefined
  const buffer = Math.min(60, Math.floor(seconds * 0.1))
  return Date.now() + Math.max(0, seconds - buffer) * 1000
}

export type CustomerOAuthSession = {
  authorizeUrl: string
  redirectUri: string
  state: string
  codeVerifier: string
}

export async function createCustomerOAuthSession(): Promise<CustomerOAuthSession> {
  if (!SHOPIFY_CUSTOMER_CLIENT_ID) {
    throw new ShopifyError("Missing EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID")
  }

  const redirectUri = resolveRedirectUri()
  const scopes = SHOPIFY_CUSTOMER_SCOPES.split(/[\s,]+/).filter(Boolean)

  const state = await generateHexStringAsync(16)
  const codeVerifier = await generateHexStringAsync(32)
  const codeChallenge = await createCodeChallenge(codeVerifier)
  const locale = resolveLocale()

  const params = new URLSearchParams({
    client_id: SHOPIFY_CUSTOMER_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  if (locale) {
    params.set("locale", locale)
  }

  console.log(`${AUTHORIZATION_ENDPOINT}?${params.toString()}`)

  return {
    authorizeUrl: `${AUTHORIZATION_ENDPOINT}?${params.toString()}`,
    redirectUri,
    state,
    codeVerifier,
  }
}

async function exchangeToken(body: Record<string, string>) {
  const redirectUri = resolveRedirectUri()

  const form = new URLSearchParams({
    client_id: SHOPIFY_CUSTOMER_CLIENT_ID!,
    redirect_uri: redirectUri,
    ...body,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })

  const payload = (await response.json()) as TokenResponse & { error?: string; error_description?: string }
  if (!response.ok) {
    throw new ShopifyError(payload.error_description || payload.error || "Failed to authenticate")
  }

  if (!payload.access_token) {
    throw new ShopifyError("Authentication payload missing access token")
  }

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
  if (state !== expectedState) {
    throw new ShopifyError("Authentication response invalid")
  }

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
  const state = useCustomerSession.getState()
  if (!state.refreshToken) return null
  if (refreshPromise && !force) return refreshPromise

  useCustomerSession.getState().markRefreshing(true)
  refreshPromise = (async () => {
    try {
      const payload = await exchangeToken({
        grant_type: "refresh_token",
        refresh_token: state.refreshToken!,
      })

      const expiresAt = computeExpiry(payload.expires_in)
      useCustomerSession.getState().setSession({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token ?? state.refreshToken,
        expiresAt,
        idToken: payload.id_token ?? state.idToken,
        scope: payload.scope ?? state.scope,
      })
      return payload
    } catch (err) {
      useCustomerSession.getState().clear()
      throw err
    } finally {
      useCustomerSession.getState().markRefreshing(false)
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function ensureCustomerAccessToken() {
  const state = useCustomerSession.getState()
  if (!state.accessToken) return null

  if (!state.expiresAt) return state.accessToken
  if (state.expiresAt - Date.now() > 60 * 1000) return state.accessToken

  const payload = await refreshCustomerAccessToken()
  return payload?.access_token ?? useCustomerSession.getState().accessToken ?? null
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
