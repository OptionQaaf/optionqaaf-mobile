import * as AuthSession from "expo-auth-session"

import { getShopifyCustomerConfig, sanitizeShopDomain } from "./config"
import { getCustomerApiConfig, getOpenIdConfig } from "./discovery"
import { AuthExpiredError } from "./errors"
import type { StoredCustomerSession } from "./types"
import {
  clearStoredCustomerSession,
  getStoredCustomerSession,
  setGraphqlEndpointForSession,
  setStoredCustomerSession,
  updateStoredCustomerSession,
} from "./tokens"

export async function startLogin(rawShopDomain?: string): Promise<StoredCustomerSession> {
  const config = getShopifyCustomerConfig()
  const shopDomain = sanitizeShopDomain(rawShopDomain || config.shopDomain)

  const [{ authorizationEndpoint, tokenEndpoint, endSessionEndpoint }, customerConfig] = await Promise.all([
    getOpenIdConfig(shopDomain),
    getCustomerApiConfig(shopDomain),
  ])

  const state = AuthSession.generateStateAsync?.() ? await AuthSession.generateStateAsync() : `${Date.now()}`
  const request = new AuthSession.AuthRequest({
    clientId: config.clientId,
    scopes: config.scopes.split(/\s+/g).filter(Boolean),
    redirectUri: config.redirectUri,
    responseType: AuthSession.ResponseType.Code,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    extraParams: { state },
  })
  const expectedState = request.state ?? state

  await request.makeAuthUrlAsync({ url: authorizationEndpoint })

  const result = await request.promptAsync({ authorizationEndpoint }, { useProxy: false })

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

  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
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
    shopDomain,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    idToken: tokens.id_token ?? null,
    scope: tokens.scope ?? null,
    tokenType: tokens.token_type ?? null,
    expiresAt: tokens.expires_in ? now + tokens.expires_in * 1000 : now + 60 * 60 * 1000,
    graphqlEndpoint: customerConfig.graphqlApi,
    tokenEndpoint,
    logoutEndpoint: endSessionEndpoint ?? null,
    idTokenIssuedAt: now,
  }

  await setStoredCustomerSession(session)
  await setGraphqlEndpointForSession(customerConfig.graphqlApi)

  return session
}

export async function logout(rawShopDomain?: string): Promise<void> {
  const config = getShopifyCustomerConfig()
  const shopDomain = sanitizeShopDomain(rawShopDomain || config.shopDomain)
  const session = await getStoredCustomerSession()
  if (!session || session.shopDomain !== shopDomain) {
    await clearStoredCustomerSession()
    return
  }

  const idToken = session.idToken
  let logoutEndpoint = session.logoutEndpoint || config.logoutEndpointOverride || null

  if (!logoutEndpoint) {
    const openId = await getOpenIdConfig(shopDomain)
    logoutEndpoint = openId.endSessionEndpoint ?? null
    if (logoutEndpoint) {
      await updateStoredCustomerSession((current) => ({
        ...current,
        logoutEndpoint,
        tokenEndpoint: openId.tokenEndpoint,
      }))
    }
  }

  if (logoutEndpoint && idToken) {
    try {
      const url = new URL(logoutEndpoint)
      url.searchParams.set("id_token_hint", idToken)
      await fetch(url.toString(), { method: "GET" })
    } catch (error) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("[Shopify][Customer] Logout request failed", error)
      }
    }
  }

  await clearStoredCustomerSession()
}

export async function requireSessionOrThrow(): Promise<StoredCustomerSession> {
  const session = await getStoredCustomerSession()
  if (!session) throw new AuthExpiredError()
  return session
}
