import {
  SHOPIFY_CUSTOMER_CLIENT_ID,
  SHOPIFY_CUSTOMER_REDIRECT_PATH,
  SHOPIFY_CUSTOMER_SCOPES,
  SHOPIFY_DOMAIN,
} from "@/lib/shopify/env"
import { useCustomerSession } from "@/features/account/session"
import { ShopifyError } from "@/lib/shopify/client"
import {
  AuthRequest,
  CodeChallengeMethod,
  ResponseType,
  generateHexStringAsync,
  makeRedirectUri,
} from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"
import { Platform } from "react-native"

WebBrowser.maybeCompleteAuthSession()

const AUTH_BASE = `https://${SHOPIFY_DOMAIN}/auth/oauth`
const AUTHORIZATION_ENDPOINT = `${AUTH_BASE}/authorize`
const TOKEN_ENDPOINT = `${AUTH_BASE}/token`
const REVOCATION_ENDPOINT = `${AUTH_BASE}/revoke`

function resolveRedirectUri() {
  return makeRedirectUri({
    scheme: Platform.select({ web: undefined, default: "optionqaafmobile" }),
    path: SHOPIFY_CUSTOMER_REDIRECT_PATH,
  })
}

type TokenResponse = {
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

export async function startCustomerSignIn() {
  if (!SHOPIFY_CUSTOMER_CLIENT_ID) {
    throw new ShopifyError("Missing EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID")
  }

  const redirectUri = resolveRedirectUri()
  const scopes = SHOPIFY_CUSTOMER_SCOPES.split(/[,\s]+/).filter(Boolean)

  const state = await generateHexStringAsync(16)
  const request = new AuthRequest({
    clientId: SHOPIFY_CUSTOMER_CLIENT_ID,
    scopes,
    redirectUri,
    responseType: ResponseType.Code,
    codeChallengeMethod: CodeChallengeMethod.S256,
    state,
  })

  await request.getAuthRequestConfigAsync()

  const result = await request.promptAsync({ authorizationEndpoint: AUTHORIZATION_ENDPOINT }, { useProxy: false })

  if (result.type !== "success") {
    if (result.type === "dismiss" || result.type === "cancel") return null
    throw new ShopifyError("Authentication was not completed")
  }

  const params = result.params || {}
  const receivedState = typeof params.state === "string" ? params.state : undefined
  if (!params.code || receivedState !== request.state) {
    throw new ShopifyError("Authentication response invalid")
  }

  const tokenPayload = await exchangeToken({
    grant_type: "authorization_code",
    code: params.code as string,
    redirect_uri: redirectUri,
    code_verifier: request.codeVerifier || "",
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

async function exchangeToken(body: Record<string, string>) {
  if (!SHOPIFY_CUSTOMER_CLIENT_ID) throw new ShopifyError("Missing EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID")

  const redirectUri = resolveRedirectUri()
  const form = new URLSearchParams({ client_id: SHOPIFY_CUSTOMER_CLIENT_ID, redirect_uri: redirectUri, ...body })

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

let refreshPromise: Promise<TokenResponse | null> | null = null

export async function refreshCustomerAccessToken(force = false) {
  const state = useCustomerSession.getState()
  if (!state.refreshToken) return null

  if (refreshPromise && !force) return refreshPromise

  useCustomerSession.getState().markRefreshing(true)
  refreshPromise = (async () => {
    try {
      const payload = await exchangeToken({ grant_type: "refresh_token", refresh_token: state.refreshToken! })
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

  if (state.expiresAt - Date.now() > 60 * 1000) {
    return state.accessToken
  }

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
    if (__DEV__) {
      console.warn("[auth] failed to revoke token", err)
    }
  }
}
