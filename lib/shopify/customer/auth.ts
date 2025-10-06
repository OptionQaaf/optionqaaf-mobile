import Constants from "expo-constants"
import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync, getRandomBytesAsync } from "expo-crypto"
import { z } from "zod"

import { getCustomerApiConfigOverride, getCustomerApiEndpoint, getOpenIdConfigOverride } from "@/lib/shopify/customer/discovery"
import { SHOPIFY_CUSTOMER_CLIENT_ID, SHOPIFY_DOMAIN, SHOPIFY_SHOP_ID } from "@/lib/shopify/env"
import { kv as mmkv } from "@/lib/storage/mmkv"

type FetchInit = RequestInit & { retry?: number }

const DEFAULT_RETRY_ATTEMPTS = 1
const CODE_VERIFIER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
const USER_AGENT = (() => {
  const name = Constants?.expoConfig?.name || "optionqaaf-mobile"
  const version = Constants?.expoConfig?.version || "0.0.0"
  return `${name}/${version} (${Constants.appOwnership || "expo"})`
})()

const authDiscoverySchema = z.object({
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  end_session_endpoint: z.string().url().optional(),
  jwks_uri: z.string().url().optional(),
  issuer: z.string().optional(),
})

const customerApiDiscoverySchema = z.object({
  graphql_api: z.string().url(),
  mcp_api: z.string().url().optional(),
})

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional().nullable(),
  id_token: z.string().optional().nullable(),
  token_type: z.string().optional().nullable(),
  scope: z.string().optional().nullable(),
  expires_in: z.number().positive(),
})

type RawAuthDiscovery = z.infer<typeof authDiscoverySchema>
type RawCustomerApiDiscovery = z.infer<typeof customerApiDiscoverySchema>
type RawTokenResponse = z.infer<typeof tokenResponseSchema>

export type AuthDiscovery = {
  authorizationEndpoint: string
  tokenEndpoint: string
  endSessionEndpoint?: string
  jwksUri?: string
  issuer?: string
}

export type CustomerApiDiscovery = {
  graphqlApi: string
  mcpApi?: string
}

export type TokenResponse = {
  accessToken: string
  refreshToken: string | null
  idToken: string | null
  tokenType?: string | null
  scope?: string | null
  expiresIn: number
}

type RetryableError = Error & { status?: number }

const authCache = new Map<string, AuthDiscovery>()
const customerApiCache = new Map<string, CustomerApiDiscovery>()
const DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000
const AUTH_DISCOVERY_KEY = "customer.discovery.auth"
const CUSTOMER_DISCOVERY_KEY = "customer.discovery.customerApi"

const SHOP_DOMAIN = sanitizeShopDomain(SHOPIFY_DOMAIN)

let loggedOpenIdOverrideUsage = false
let loggedCustomerOverrideUsage = false

export class CustomerAuthError extends Error {
  constructor(
    message: string,
    public code: "DISCOVERY_TIMEOUT" | "TOKEN_TIMEOUT",
  ) {
    super(message)
    this.name = "CustomerAuthError"
  }
}

/**
 * Fetch JSON with minimal retry support for transient network errors.
 */
async function fetchJson<T>(url: string, schema: z.ZodSchema<T>, init?: FetchInit): Promise<T> {
  const deadline = Date.now() + 15_000
  const maxAttempts = (init?.retry ?? DEFAULT_RETRY_ATTEMPTS) + 10
  let delay = 800
  let lastResponse: Response | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxAttempts && Date.now() < deadline; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          ...(init?.headers ?? {}),
        },
      })
      clearTimeout(timeout)

      if (res.ok) {
        const data = await res.json()
        return schema.parse(data)
      }

      const status = res.status
      if ((status === 429 || status >= 500) && Date.now() < deadline) {
        lastResponse = res
        const retryHeader = res.headers.get("retry-after")
        const wait = retryHeader ? Number(retryHeader) * 1000 : delay
        await sleep(wait + Math.random() * 150)
        delay = Math.min(delay * 2, 8000)
        continue
      }

      const err: RetryableError = new Error(`Request failed with status ${status}`)
      err.status = status
      throw err
    } catch (error: any) {
      clearTimeout(timeout)
      lastError = error
      if (error?.name === "AbortError") {
        if (Date.now() >= deadline) break
        continue
      }

      const status = error?.status as number | undefined
      if ((status === 429 || status >= 500) && Date.now() < deadline) {
        await sleep(delay + Math.random() * 150)
        delay = Math.min(delay * 2, 8000)
        continue
      }

      if (Date.now() >= deadline) break
      throw error
    }
  }

  if (Date.now() >= deadline) {
    throw new CustomerAuthError("Discovery request timed out", "DISCOVERY_TIMEOUT")
  }

  if (lastResponse) {
    const text = await lastResponse.text().catch(() => "")
    const err: RetryableError = new Error(
      `Discovery request failed (${lastResponse.status})${text ? `: ${text}` : ""}`,
    )
    err.status = lastResponse.status
    throw err
  }

  if (lastError instanceof CustomerAuthError) throw lastError
  if (lastError instanceof Error) throw lastError
  throw new CustomerAuthError("Discovery request failed", "DISCOVERY_TIMEOUT")
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tokenRequest(url: string, body: string): Promise<Response> {
  const deadline = Date.now() + 15_000
  const maxAttempts = 8
  let delay = 800
  let lastResponse: Response | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxAttempts && Date.now() < deadline; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        body,
      })
      clearTimeout(timeout)

      if (res.ok) return res

      if ((res.status === 429 || res.status >= 500) && Date.now() < deadline) {
        lastResponse = res
        const retryHeader = res.headers.get("retry-after")
        const wait = retryHeader ? Number(retryHeader) * 1000 : delay
        await sleep(wait + Math.random() * 150)
        delay = Math.min(delay * 2, 8000)
        continue
      }

      return res
    } catch (error: any) {
      clearTimeout(timeout)
      lastError = error
      if (error?.name === "AbortError") {
        if (Date.now() >= deadline) break
        continue
      }
      await sleep(delay + Math.random() * 150)
      delay = Math.min(delay * 2, 8000)
    }
  }

  if (Date.now() >= deadline) {
    throw new CustomerAuthError("Token request timed out", "TOKEN_TIMEOUT")
  }

  if (lastResponse) {
    const text = await lastResponse.text().catch(() => "")
    const err: RetryableError = new Error(
      `Token request failed (${lastResponse.status})${text ? `: ${text}` : ""}`,
    )
    err.status = lastResponse.status
    throw err
  }

  if (lastError instanceof CustomerAuthError) throw lastError
  if (lastError instanceof Error) throw lastError
  throw new CustomerAuthError("Token request failed", "TOKEN_TIMEOUT")
}

function sanitizeShopDomain(domain: string) {
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

function toCamelAuth(src: RawAuthDiscovery): AuthDiscovery {
  return {
    authorizationEndpoint: src.authorization_endpoint,
    tokenEndpoint: src.token_endpoint,
    endSessionEndpoint: src.end_session_endpoint,
    jwksUri: src.jwks_uri,
    issuer: src.issuer,
  }
}

function toCamelCustomerApi(src: RawCustomerApiDiscovery): CustomerApiDiscovery {
  return {
    graphqlApi: src.graphql_api,
    mcpApi: src.mcp_api,
  }
}

function toTokenResponse(src: RawTokenResponse): TokenResponse {
  return {
    accessToken: src.access_token,
    refreshToken: src.refresh_token ?? null,
    idToken: src.id_token ?? null,
    tokenType: src.token_type ?? null,
    scope: src.scope ?? null,
    expiresIn: src.expires_in,
  }
}

/**
 * Discover OpenID Connect endpoints for the configured shop.
 */
type CachedEntry<T> = { value: T; expiresAt: number }

function readDiscoveryEntry<T>(key: string): { value: T; expired: boolean } | null {
  const raw = mmkv.get(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedEntry<T>
    if (!parsed?.value) return null
    const expired = !parsed.expiresAt || Date.now() > parsed.expiresAt
    return { value: parsed.value, expired }
  } catch {
    mmkv.del(key)
    return null
  }
}

function writeDiscovery<T>(key: string, value: T) {
  const entry: CachedEntry<T> = { value, expiresAt: Date.now() + DISCOVERY_TTL_MS }
  mmkv.set(key, JSON.stringify(entry))
}

export async function getAuthDiscoveryCached(shopDomain: string = SHOP_DOMAIN): Promise<AuthDiscovery> {
  const key = sanitizeShopDomain(shopDomain)
  const override = getOpenIdConfigOverride()
  if (!loggedOpenIdOverrideUsage && typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[CustomerAuth] Using overrides for OpenID:", Boolean(override))
    loggedOpenIdOverrideUsage = true
  }
  if (override) {
    const discovery = toCamelAuth({
      authorization_endpoint: override.authorization_endpoint,
      token_endpoint: override.token_endpoint,
      end_session_endpoint: override.end_session_endpoint,
      jwks_uri: override.jwks_uri,
      issuer: override.issuer,
    } as RawAuthDiscovery)
    authCache.set(key, discovery)
    return discovery
  }
  if (authCache.has(key)) return authCache.get(key)!
  const mmkvKey = `${AUTH_DISCOVERY_KEY}:${key}`
  const persistedEntry = readDiscoveryEntry<AuthDiscovery>(mmkvKey)
  if (persistedEntry && !persistedEntry.expired) {
    authCache.set(key, persistedEntry.value)
    return persistedEntry.value
  }
  const url = `https://${key}/.well-known/openid-configuration`
  try {
    const discovery = toCamelAuth(await fetchJson(url, authDiscoverySchema))
    authCache.set(key, discovery)
    writeDiscovery(mmkvKey, discovery)
    return discovery
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      const status = (error as any)?.status as number | undefined
      const reason = error instanceof CustomerAuthError && error.code === "DISCOVERY_TIMEOUT"
        ? "timeout"
        : status === 429
          ? "429"
          : undefined
      if (reason) {
        const suffix = persistedEntry ? " – falling back to overrides/cache" : ""
        console.warn(`[CustomerAuth] Discovery failed (${reason})${suffix}`)
      }
    }
    if (persistedEntry) {
      authCache.set(key, persistedEntry.value)
      return persistedEntry.value
    }
    throw error
  }
}

/**
 * Discover Shopify customer API endpoints for the configured shop.
 */
export async function getCustomerApiDiscoveryCached(shopDomain: string = SHOP_DOMAIN): Promise<CustomerApiDiscovery> {
  const key = sanitizeShopDomain(shopDomain)
  const override = getCustomerApiConfigOverride()
  if (!loggedCustomerOverrideUsage && typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[CustomerAuth] Using overrides for Customer API:", Boolean(override))
    loggedCustomerOverrideUsage = true
  }
  if (override) {
    const discovery = toCamelCustomerApi({
      graphql_api: override.graphql_api,
      mcp_api: override.mcp_api,
    } as RawCustomerApiDiscovery)
    customerApiCache.set(key, discovery)
    return discovery
  }

  if (customerApiCache.has(key)) return customerApiCache.get(key)!

  const endpoint = await getCustomerApiEndpoint()
  const discovery: CustomerApiDiscovery = { graphqlApi: endpoint }
  customerApiCache.set(key, discovery)
  return discovery
}

function base64Url(input: string): string {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function randomUrlString(length: number): Promise<string> {
  const bytes = await getRandomBytesAsync(length)
  return mapBytesToUrlChars(bytes)
}

function randomUrlStringSync(length: number): string {
  return mapBytesToUrlChars(getRandomBytesSync(length))
}

function mapBytesToUrlChars(bytes: Uint8Array): string {
  const chars = Array.from(bytes, (b) => CODE_VERIFIER_CHARS[b % CODE_VERIFIER_CHARS.length])
  return chars.join("")
}

function getRandomBytesSync(length: number): Uint8Array {
  if (length <= 0) throw new Error("Random byte length must be positive")
  const out = new Uint8Array(length)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(out)
    return out
  }
  for (let i = 0; i < length; i += 1) {
    out[i] = Math.floor(Math.random() * 256)
  }
  return out
}

/**
 * Create PKCE verifier/challenge pair using S256.
 */
export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = await randomUrlString(64)
  const digest = await digestStringAsync(CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: CryptoEncoding.BASE64,
  })
  return { verifier, challenge: base64Url(digest) }
}

/**
 * Generate random state for OAuth round-trip verification.
 */
export function generateState(): string {
  return base64Url(Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))
}

/**
 * Generate nonce value with configurable entropy (default 22 characters).
 */
export function generateNonce(len = 22): string {
  if (len <= 0) throw new Error("Nonce length must be positive")
  return randomUrlStringSync(len)
}

function buildFormBody(params: Record<string, string | undefined | null>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.append(key, value)
  })
  return search.toString()
}

type ExchangeArgs = {
  code: string
  codeVerifier: string
  redirectUri: string
  shopDomain?: string
  tokenEndpoint?: string
  clientId?: string
}

/**
 * Exchange the authorization code for access and refresh tokens.
 */
export async function exchangeCodeForToken({
  code,
  codeVerifier,
  redirectUri,
  shopDomain = SHOP_DOMAIN,
  tokenEndpoint,
  clientId = SHOPIFY_CUSTOMER_CLIENT_ID,
}: ExchangeArgs): Promise<TokenResponse> {
  const discovery = await getAuthDiscoveryCached(shopDomain)
  const endpoint = tokenEndpoint ?? discovery.tokenEndpoint
  const body = buildFormBody({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })
  const res = await tokenRequest(endpoint, body)
  if (!res.ok) {
    const text = await res.text()
    const err: RetryableError = new Error(`Token exchange failed (${res.status})${text ? `: ${text}` : ""}`)
    err.status = res.status
    throw err
  }
  const json = await res.json()
  return toTokenResponse(tokenResponseSchema.parse(json))
}

type RefreshArgs = {
  refreshToken: string
  shopDomain?: string
  tokenEndpoint?: string
  clientId?: string
}

/**
 * Refresh the access token using a refresh token grant.
 */
export async function refreshAccessToken({
  refreshToken,
  shopDomain = SHOP_DOMAIN,
  tokenEndpoint,
  clientId = SHOPIFY_CUSTOMER_CLIENT_ID,
}: RefreshArgs): Promise<TokenResponse> {
  const discovery = await getAuthDiscoveryCached(shopDomain)
  const endpoint = tokenEndpoint ?? discovery.tokenEndpoint
  const body = buildFormBody({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  })
  const res = await tokenRequest(endpoint, body)
  if (!res.ok) {
    const text = await res.text()
    const err: RetryableError = new Error(`Token refresh failed (${res.status})${text ? `: ${text}` : ""}`)
    err.status = res.status
    throw err
  }
  const json = await res.json()
  return toTokenResponse(tokenResponseSchema.parse(json))
}

type LogoutArgs = {
  idToken: string
  shopDomain?: string
  endSessionEndpoint?: string
}

/**
 * Call Shopify end-session endpoint to invalidate the session server-side.
 */
export async function logout({
  idToken,
  shopDomain = SHOP_DOMAIN,
  endSessionEndpoint,
}: LogoutArgs): Promise<void> {
  if (!idToken) return
  const discovery = await getAuthDiscoveryCached(shopDomain)
  const endpoint = endSessionEndpoint ?? discovery.endSessionEndpoint
  if (!endpoint) return
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: buildFormBody({ id_token_hint: idToken, client_id: SHOPIFY_CUSTOMER_CLIENT_ID, shop_id: SHOPIFY_SHOP_ID }),
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    console.warn(`[shopify] logout failed ${res.status}: ${text}`)
  }
}

/**
 * Utility to decode JWT payload for nonce validation without verifying signature.
 */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length < 2) return null
  try {
    const payload = parts[1]
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
    const decoded = globalThis.atob ? globalThis.atob(padded) : decodeBase64(padded)
    return JSON.parse(decoded) as T
  } catch {
    return null
  }
}

function decodeBase64(input: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(input, "base64").toString("utf-8")
  const binary = globalThis.atob ? globalThis.atob(input) : ""
  return binary
}

export const SHOPIFY_CUSTOMER_SCOPES = "openid email customer-account-api:full"
