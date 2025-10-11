import * as WebBrowser from "expo-web-browser"
import * as Crypto from "expo-crypto"
import { Buffer } from "buffer"

import { getCustomerAuthConfig } from "@/lib/config/customerAuth"
import { discoverOpenID, type OpenIdDiscoveryResult } from "./discovery"

WebBrowser.maybeCompleteAuthSession()

const RANDOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
const STATE_BYTES = 32
const NONCE_BYTES = 32
const CODE_VERIFIER_LENGTH = 64
const MAX_TOKEN_ATTEMPTS = 4

export type OAuthTokens = {
  accessToken: string
  idToken?: string
  refreshToken?: string
  expiresIn?: number
  expiresAt: number
  scope?: string
  tokenType?: string
  raw: Record<string, any>
}

class OAuthError extends Error {
  status?: number
  body?: unknown

  constructor(message: string, status?: number, body?: unknown, cause?: unknown) {
    super(message)
    this.name = "OAuthError"
    this.status = status
    this.body = body
    if (cause) {
      try {
        ;(this as any).cause = cause
      } catch {
        // ignore
      }
    }
  }
}

type PendingAuth = {
  codeVerifier: string
  nonce: string
}

const pendingAuth = new Map<string, PendingAuth>()

function extractParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {}

  const appendParams = (search: string | null | undefined) => {
    if (!search) return
    const normalized = search.startsWith("?") || search.startsWith("#") ? search.slice(1) : search
    const searchParams = new URLSearchParams(normalized)
    searchParams.forEach((value, key) => {
      params[key] = value
    })
  }

  try {
    const parsed = new URL(url)
    appendParams(parsed.search)
    appendParams(parsed.hash)
  } catch {
    const [beforeHash, hash] = url.split("#")
    if (beforeHash?.includes("?")) {
      appendParams(beforeHash.substring(beforeHash.indexOf("?") + 1))
    }
    if (hash) {
      appendParams(hash)
    }
  }

  return params
}

function randomUrlSafeString(length: number): string {
  const bytes = Crypto.getRandomBytes(length)
  let output = ""
  for (let i = 0; i < length; i += 1) {
    const index = bytes[i] % RANDOM_ALPHABET.length
    output += RANDOM_ALPHABET[index]
  }
  return output
}

function toBase64Url(input: string): string {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = randomUrlSafeString(CODE_VERIFIER_LENGTH)
  const challenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  })
  const codeChallenge = toBase64Url(challenge)
  return { codeVerifier, codeChallenge }
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000
  }
  const asDate = Date.parse(header)
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now()
    return delta > 0 ? delta : null
  }
  return null
}

function resolveRedirect(baseUrl: string, location: string): string {
  try {
    const resolved = new URL(location, baseUrl)
    return resolved.toString()
  } catch {
    return location
  }
}

async function postFormWithRetry(url: string, body: URLSearchParams, headers: Record<string, string>): Promise<any> {
  let currentUrl = url
  let attempt = 0
  let delayMs = 0
  let redirects = 0
  let lastError: unknown

  while (attempt < MAX_TOKEN_ATTEMPTS) {
    if (attempt > 0 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    const response = await fetch(currentUrl, {
      method: "POST",
      headers,
      body: body.toString(),
    })

    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location")
      if (!location || redirects > 4) {
        throw new OAuthError(`Too many redirects while calling ${currentUrl}`, response.status)
      }
      currentUrl = resolveRedirect(currentUrl, location)
      redirects += 1
      continue
    }

    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"))
      delayMs = retryAfter ?? Math.max(500, Math.pow(2, attempt) * 400)
      attempt += 1
      lastError = new OAuthError("Token endpoint throttled", response.status)
      continue
    }

    const text = await response.text().catch(() => "")
    let json: any
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = undefined
      }
    }

    if (response.status < 200 || response.status >= 300) {
      const errorDescription =
        json?.error_description || json?.error || text || `HTTP ${response.status} during token exchange`
      throw new OAuthError(String(errorDescription), response.status, json ?? text)
    }

    return json ?? {}
  }

  throw lastError instanceof Error ? lastError : new OAuthError("Token endpoint failed after retries")
}

function decodeIdTokenPayload(idToken: string | undefined): Record<string, any> | null {
  if (!idToken) return null
  const parts = idToken.split(".")
  if (parts.length < 2) return null
  const payload = parts[1]
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")

  const globalAtob = typeof globalThis.atob === "function" ? globalThis.atob : undefined

  if (globalAtob) {
    try {
      const binary = globalAtob(padded)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null
      const decoded = decoder
        ? decoder.decode(bytes)
        : Array.from(bytes)
            .map((byte) => String.fromCharCode(byte))
            .join("")
      return JSON.parse(decoded)
    } catch {
      return null
    }
  }

  try {
    const decoded = Buffer.from(padded, "base64").toString("utf-8")
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function assertNonceMatches(idToken: string | undefined, expectedNonce: string): void {
  if (!idToken) return
  const payload = decodeIdTokenPayload(idToken)
  const tokenNonce = payload?.nonce
  if (tokenNonce && tokenNonce !== expectedNonce) {
    throw new OAuthError("Nonce mismatch in ID token")
  }
}

export async function performHostedLogin(options?: { locale?: string }): Promise<{
  tokens: OAuthTokens
  discovery: OpenIdDiscoveryResult
}> {
  const config = getCustomerAuthConfig()
  const openId = await discoverOpenID(config.shopDomain)
  const { codeVerifier, codeChallenge } = await generatePkcePair()
  const state = randomUrlSafeString(STATE_BYTES)
  const nonce = randomUrlSafeString(NONCE_BYTES)

  pendingAuth.set(state, { codeVerifier, nonce })

  const authorizeParams = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes,
    response_type: "code",
    redirect_uri: config.redirectUri,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  if (options?.locale) {
    authorizeParams.set("locale", options.locale)
  }

  const authorizeUrl = `${openId.authorizationEndpoint}?${authorizeParams.toString()}`
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, config.redirectUri, {
    preferEphemeralSession: true,
  })

  if (result.type !== "success" || !("url" in result) || !result.url) {
    pendingAuth.delete(state)
    const message =
      result.type === "dismiss"
        ? "Authentication dismissed"
        : result.type === "cancel"
          ? "Authentication cancelled"
          : result.type === "locked"
            ? "Authentication is already in progress"
            : "Authentication failed"
    throw new OAuthError(message)
  }

  const params = extractParamsFromUrl(result.url)
  if (!params?.code) {
    pendingAuth.delete(state)
    throw new OAuthError("Authorization response missing code")
  }

  if (params.state !== state) {
    pendingAuth.delete(state)
    throw new OAuthError("State mismatch during OAuth flow")
  }

  const pending = pendingAuth.get(state)
  pendingAuth.delete(state)
  if (!pending) {
    throw new OAuthError("Unable to resolve PKCE verifier for OAuth state")
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code: params.code,
    redirect_uri: config.redirectUri,
    code_verifier: pending.codeVerifier,
  })

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "User-Agent": config.userAgent,
  }

  const tokenJson = await postFormWithRetry(openId.tokenEndpoint, tokenBody, headers)
  assertNonceMatches(tokenJson.id_token, pending.nonce)

  const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : undefined
  const expiresAt = Date.now() + (expiresIn ? expiresIn * 1000 : 0)

  const tokens: OAuthTokens = {
    accessToken: tokenJson.access_token,
    idToken: tokenJson.id_token,
    refreshToken: tokenJson.refresh_token,
    expiresIn,
    expiresAt,
    scope: tokenJson.scope,
    tokenType: tokenJson.token_type,
    raw: tokenJson,
  }

  return { tokens, discovery: openId }
}

export async function refreshTokens(
  refreshToken: string,
  openIdOverride?: OpenIdDiscoveryResult,
): Promise<OAuthTokens> {
  const config = getCustomerAuthConfig()
  const openId = openIdOverride ?? (await discoverOpenID(config.shopDomain))

  const tokenBody = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  })

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "User-Agent": config.userAgent,
  }

  const tokenJson = await postFormWithRetry(openId.tokenEndpoint, tokenBody, headers)
  const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : undefined
  const expiresAt = Date.now() + (expiresIn ? expiresIn * 1000 : 0)

  return {
    accessToken: tokenJson.access_token,
    idToken: tokenJson.id_token,
    refreshToken: tokenJson.refresh_token || refreshToken,
    expiresIn,
    expiresAt,
    scope: tokenJson.scope,
    tokenType: tokenJson.token_type,
    raw: tokenJson,
  }
}

export async function performLogout(idToken?: string, openIdOverride?: OpenIdDiscoveryResult): Promise<void> {
  const config = getCustomerAuthConfig()
  const openId = openIdOverride ?? (await discoverOpenID(config.shopDomain))
  const endpoint = openId.logoutEndpoint || config.fallbackAuthEndpoints.logoutEndpoint
  if (!endpoint) return

  try {
    const url = new URL(endpoint)
    url.searchParams.set("client_id", config.clientId)
    if (idToken) {
      url.searchParams.set("id_token_hint", idToken)
    }
    await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": config.userAgent,
      },
    })
  } catch (error) {
    if (config.debugAuth) {
      console.warn("[auth] Logout request failed", error)
    }
  }
}

export function decodeIdToken(idToken: string | undefined): Record<string, any> | null {
  return decodeIdTokenPayload(idToken)
}

export const __testables = {
  randomUrlSafeString,
  toBase64Url,
  generatePkcePair,
}
