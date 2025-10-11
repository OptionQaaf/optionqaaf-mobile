import * as AuthSession from "expo-auth-session"

import { getCustomerApiEndpoint } from "./discovery"
import { getShopifyCustomerConfig } from "./config"
import { SHOP_ID } from "./env"
import { getOidcEndpoints } from "./oauth"
import { AuthExpiredError } from "./errors"
import type { StoredCustomerSession } from "./types"
import {
  clearStoredCustomerSession,
  getStoredCustomerSession,
  setGraphqlEndpointForSession,
  setStoredCustomerSession,
  updateStoredCustomerSession,
} from "./tokens"

const REQUIRED_SCOPES = new Set(["openid", "email", "customer-account-api:full"])

function buildScopeList(scopes: string): string[] {
  const values = new Set<string>()
  scopes
    .split(/\s+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((scope) => values.add(scope))
  REQUIRED_SCOPES.forEach((scope) => values.add(scope))
  return Array.from(values)
}

export async function startLogin(): Promise<StoredCustomerSession> {
  const config = getShopifyCustomerConfig()

  const [oidc, graphqlEndpoint] = await Promise.all([getOidcEndpoints(), getCustomerApiEndpoint()])

  let state: string
  try {
    state = await AuthSession.generateHexStringAsync(16)
  } catch {
    state = Math.random().toString(36).slice(2)
  }
  const scopes = buildScopeList(config.scopes)

  const request = new AuthSession.AuthRequest({
    clientId: config.clientId,
    scopes,
    redirectUri: config.redirectUri,
    responseType: AuthSession.ResponseType.Code,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    state,
  })

  const discoveryDocument = { authorizationEndpoint: oidc.authorizationEndpoint }

  const expectedState = request.state ?? state

  await request.makeAuthUrlAsync(discoveryDocument)

  const result = await request.promptAsync(
    discoveryDocument,
  )

  if (result.type !== "success") {
    throw new Error(result.type === "cancel" ? "Login cancelled" : "Authentication failed")
  }

  const params = result.params ?? {}
  if (params.state !== expectedState) {
    throw new Error("State mismatch. Ensure the callback URL matches the configured scheme.")
  }
  if (!params.code) {
    throw new Error("Missing authorization code from Shopify")
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
  })
  if (request.codeVerifier) {
    body.set("code_verifier", request.codeVerifier)
  }

  const tokenResponse = await fetch(oidc.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  })

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => "")
    throw new Error(`Token exchange failed (${tokenResponse.status})${detail ? `: ${detail}` : ""}`)
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string
    refresh_token?: string
    id_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
  }

  if (!tokens.access_token) {
    throw new Error("Token exchange failed: missing access token")
  }

  const now = Date.now()
  const session: StoredCustomerSession = {
    shopId: SHOP_ID,
    shopDomain: config.shopDomain ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    idToken: tokens.id_token ?? null,
    scope: tokens.scope ?? null,
    tokenType: tokens.token_type ?? null,
    expiresAt: tokens.expires_in ? now + tokens.expires_in * 1000 : now + 60 * 60 * 1000,
    graphqlEndpoint,
    tokenEndpoint: oidc.tokenEndpoint,
    logoutEndpoint: oidc.endSessionEndpoint ?? null,
    idTokenIssuedAt: now,
  }

  await setStoredCustomerSession(session)
  await setGraphqlEndpointForSession(graphqlEndpoint)

  return session
}

export async function logout(): Promise<void> {
  const config = getShopifyCustomerConfig()
  const session = await getStoredCustomerSession()
  if (!session || session.shopId !== SHOP_ID) {
    await clearStoredCustomerSession()
    return
  }

  const idToken = session.idToken
  let logoutEndpoint = session.logoutEndpoint || config.logoutEndpointOverride || null

  if (!logoutEndpoint) {
    try {
      const oidc = await getOidcEndpoints({ forceRefresh: true })
      logoutEndpoint = oidc.endSessionEndpoint ?? null
      if (logoutEndpoint) {
        await updateStoredCustomerSession((current) => ({
          ...current,
          logoutEndpoint,
          tokenEndpoint: oidc.tokenEndpoint,
        }))
      }
    } catch (error) {
      if (typeof __DEV__ === "undefined" || __DEV__) {
        console.warn("[CAAPI][oauth] Failed to refresh logout endpoint", error)
      }
    }
  }

  if (logoutEndpoint && idToken) {
    try {
      const url = new URL(logoutEndpoint)
      url.searchParams.set("id_token_hint", idToken)
      await fetch(url.toString(), { method: "GET" })
    } catch (error) {
      if (typeof __DEV__ === "undefined" || __DEV__) {
        console.warn("[CAAPI][oauth] Logout request failed", error)
      }
    }
  }

  await clearStoredCustomerSession()
}

export async function requireSessionOrThrow(): Promise<StoredCustomerSession> {
  const session = await getStoredCustomerSession()
  if (!session || session.shopId !== SHOP_ID) {
    throw new AuthExpiredError()
  }
  return session
}
