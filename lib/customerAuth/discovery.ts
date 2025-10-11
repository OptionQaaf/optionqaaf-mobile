import { getCustomerAuthConfig } from "@/lib/config/customerAuth"
import { kv } from "@/lib/storage/mmkv"

const TTL_MS = 1000 * 60 * 60 * 24 // 24 hours
const FALLBACK_TTL_MS = 1000 * 60 * 5
const MAX_ATTEMPTS = 4

export type DiscoverySource = "discovery" | "override" | "fallback" | "cache"

export type OpenIdDiscoveryResult = {
  authorizationEndpoint: string
  tokenEndpoint: string
  logoutEndpoint?: string
  issuer: string
  jwksUri?: string
  source: DiscoverySource
}

export type CustomerApiDiscoveryResult = {
  graphqlApi: string
  mcpApi?: string
  source: DiscoverySource
}

type CachePayload<T> = {
  data: T
  expiresAt: number
  etag?: string
}

export class DiscoveryError extends Error {
  status?: number
  details?: Record<string, unknown>

  constructor(message: string, status?: number, details?: Record<string, unknown>, cause?: unknown) {
    super(message)
    this.name = "DiscoveryError"
    this.status = status
    this.details = details
    if (cause) {
      try {
        ;(this as any).cause = cause
      } catch {
        // ignore
      }
    }
  }
}

const memoryCache = new Map<string, CachePayload<any>>()

function normalizeDomain(input: string): string {
  return input.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

function normalizeDiscoveryUrl(input: string): string {
  if (!input) return input
  const trimmed = input.trim()
  if (trimmed.length === 0) return trimmed
  if (/\.well-known\//.test(trimmed)) return trimmed.replace(/\/$/, "")
  const sanitized = trimmed.replace(/\/$/, "")
  return `${sanitized}/.well-known/openid-configuration`
}

function resolveRedirect(baseUrl: string, location: string): string {
  try {
    const resolved = new URL(location, baseUrl)
    return resolved.toString()
  } catch {
    return location
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000
  const asDate = Date.parse(header)
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now()
    return delta > 0 ? delta : null
  }
  return null
}

function getCacheKey(type: "openid" | "customer", shopDomain: string): string {
  return `customer-auth:${type}:${shopDomain}`
}

function getCacheEntry<T>(key: string): CachePayload<T> | null {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as CachePayload<T>
  }
  const raw = kv.get(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachePayload<T>
    if (parsed && typeof parsed.expiresAt === "number") {
      memoryCache.set(key, parsed)
      return parsed
    }
  } catch {
    kv.del(key)
  }
  return null
}

function setCacheEntry<T>(key: string, payload: CachePayload<T>) {
  memoryCache.set(key, payload)
  try {
    kv.set(key, JSON.stringify(payload))
  } catch {
    // ignore storage errors
  }
}

function pickFreshEntry<T>(entry: CachePayload<T> | null): CachePayload<T> | null {
  if (!entry) return null
  if (entry.expiresAt > Date.now()) return entry
  return null
}

type WellKnownFetchResult<T> =
  | { status: "ok"; json: T; etag?: string; url: string }
  | { status: "not-modified"; etag?: string; url: string }

async function requestWellKnown<T>(url: string, previousEtag?: string): Promise<WellKnownFetchResult<T>> {
  let currentUrl = url
  let redirects = 0

  while (true) {
    const headers: Record<string, string> = { Accept: "application/json" }
    if (previousEtag) headers["If-None-Match"] = previousEtag

    const response = await fetch(currentUrl, {
      headers,
      redirect: "manual" as RequestRedirect,
    })

    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location")
      if (!location || redirects > 4) {
        throw new DiscoveryError(`Too many redirects from ${currentUrl}`, response.status)
      }
      currentUrl = resolveRedirect(currentUrl, location)
      redirects += 1
      continue
    }

    if (response.status === 304) {
      return { status: "not-modified", etag: previousEtag, url: currentUrl }
    }

    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"))
      throw new DiscoveryError(`Discovery throttled for ${currentUrl}`, 429, {
        retryAfterMs: retryAfter ?? undefined,
      })
    }

    if (response.status < 200 || response.status >= 300) {
      const text = await response.text().catch(() => "")
      throw new DiscoveryError(
        `Discovery request failed with status ${response.status}`,
        response.status,
        text ? { body: text } : undefined,
      )
    }

    const text = await response.text()
    try {
      const json = JSON.parse(text) as T
      return { status: "ok", json, etag: response.headers.get("ETag") ?? undefined, url: currentUrl }
    } catch (error) {
      throw new DiscoveryError("Discovery response was not valid JSON", response.status, undefined, error)
    }
  }
}

async function fetchWellKnownWithRetry<T>(
  url: string,
  previousEtag?: string,
): Promise<WellKnownFetchResult<T>> {
  let attempt = 0
  let delayMs = 0
  let lastError: unknown
  let nextEtag = previousEtag
  while (attempt < MAX_ATTEMPTS) {
    if (attempt > 0 && delayMs > 0) {
      await sleep(delayMs)
    }
    try {
      const result = await requestWellKnown<T>(url, nextEtag)
      return result
    } catch (error) {
      lastError = error
      if (error instanceof DiscoveryError && error.status === 429) {
        const retryAfterMs = typeof error.details?.retryAfterMs === "number" ? error.details.retryAfterMs : null
        delayMs = retryAfterMs ? Math.max(500, retryAfterMs) : Math.max(500, Math.pow(2, attempt) * 400)
        attempt += 1
        continue
      }
      throw error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Discovery failed after retries")
}

type OpenIdWellKnown = {
  authorization_endpoint?: string
  token_endpoint?: string
  end_session_endpoint?: string
  end_session_endpoint_v2?: string
  end_session_endpoint_v1?: string
  logout_endpoint?: string
  jwks_uri?: string
  issuer?: string
}

function mapOpenIdResponse(json: OpenIdWellKnown, source: DiscoverySource): OpenIdDiscoveryResult {
  const authorizationEndpoint = json.authorization_endpoint
  const tokenEndpoint = json.token_endpoint

  if (!authorizationEndpoint || !tokenEndpoint) {
    throw new DiscoveryError("OpenID configuration missing required endpoints")
  }

  const logoutEndpoint =
    json.end_session_endpoint || json.logout_endpoint || json.end_session_endpoint_v2 || json.end_session_endpoint_v1

  return {
    authorizationEndpoint,
    tokenEndpoint,
    logoutEndpoint: logoutEndpoint || undefined,
    issuer: json.issuer || "",
    jwksUri: json.jwks_uri,
    source,
  }
}

type CustomerApiWellKnown = {
  graphql_api?: string
  graphql?: string
  endpoints?: {
    graphql?: string
  }
  mcp_api?: string
  cache_control?: { max_age?: number }
  cacheControl?: { maxAge?: number }
  ttl_ms?: number
  ttl_seconds?: number
}

function mapCustomerApiResponse(json: CustomerApiWellKnown, source: DiscoverySource): CustomerApiDiscoveryResult & { ttl: number } {
  const graphqlApi =
    json.graphql_api || json.graphql || (json.endpoints?.graphql ?? "")
  if (!graphqlApi) {
    throw new DiscoveryError("Customer Account API discovery did not return a GraphQL endpoint")
  }

  const ttlCandidates = [
    json.ttl_ms,
    json.ttl_seconds ? json.ttl_seconds * 1000 : undefined,
    json.cacheControl?.maxAge ? json.cacheControl.maxAge * 1000 : undefined,
    json.cache_control?.max_age ? json.cache_control.max_age * 1000 : undefined,
  ]

  const ttl = ttlCandidates.find((value) => typeof value === "number" && value > 0) ?? TTL_MS

  return {
    graphqlApi,
    mcpApi: json.mcp_api,
    source,
    ttl,
  }
}

export async function discoverOpenID(shopDomain?: string): Promise<OpenIdDiscoveryResult> {
  const config = getCustomerAuthConfig()
  const domain = normalizeDomain(shopDomain ?? config.shopDomain)
  const cacheKey = getCacheKey("openid", domain)
  const cached = getCacheEntry<OpenIdDiscoveryResult>(cacheKey)
  const freshCached = pickFreshEntry(cached)

  if (config.overrides.authorizationEndpoint && config.overrides.tokenEndpoint) {
    return {
      authorizationEndpoint: config.overrides.authorizationEndpoint,
      tokenEndpoint: config.overrides.tokenEndpoint,
      logoutEndpoint: config.overrides.logoutEndpoint,
      issuer: config.overrides.openIdConfigurationUrl || `https://shopify.com/authentication/${config.shopId}`,
      source: "override",
    }
  }

  if (freshCached) {
    return { ...freshCached.data, source: freshCached.data.source ?? "cache" }
  }

  const discoveryUrl = normalizeDiscoveryUrl(
    config.overrides.openIdConfigurationUrl || `https://${domain}/.well-known/openid-configuration`,
  )

  try {
    const result = await fetchWellKnownWithRetry<OpenIdWellKnown>(discoveryUrl, cached?.etag)
    if (result.status === "not-modified" && cached) {
      const renewed: CachePayload<OpenIdDiscoveryResult> = {
        data: { ...cached.data, source: cached.data.source ?? "cache" },
        etag: cached.etag,
        expiresAt: Date.now() + TTL_MS,
      }
      setCacheEntry(cacheKey, renewed)
      return renewed.data
    }
    if (result.status === "ok") {
      const mapped = mapOpenIdResponse(result.json, "discovery")
      const payload: CachePayload<OpenIdDiscoveryResult> = {
        data: mapped,
        etag: result.etag,
        expiresAt: Date.now() + TTL_MS,
      }
      setCacheEntry(cacheKey, payload)
      return mapped
    }
    throw new DiscoveryError("Unexpected discovery response state")
  } catch (error) {
    if (cached) {
      const restored = { ...cached.data, source: cached.data.source ?? "cache" }
      return restored
    }

    const fallback: OpenIdDiscoveryResult = {
      authorizationEndpoint: config.fallbackAuthEndpoints.authorizationEndpoint,
      tokenEndpoint: config.fallbackAuthEndpoints.tokenEndpoint,
      logoutEndpoint: config.fallbackAuthEndpoints.logoutEndpoint,
      issuer: `https://shopify.com/authentication/${config.shopId}`,
      source: "fallback",
    }

    const payload: CachePayload<OpenIdDiscoveryResult> = {
      data: fallback,
      expiresAt: Date.now() + FALLBACK_TTL_MS,
    }
    setCacheEntry(cacheKey, payload)
    return fallback
  }
}

export async function discoverCustomerAPI(shopDomain?: string): Promise<CustomerApiDiscoveryResult> {
  const config = getCustomerAuthConfig()
  const domain = normalizeDomain(shopDomain ?? config.shopDomain)
  const cacheKey = getCacheKey("customer", domain)
  const cached = getCacheEntry<CustomerApiDiscoveryResult & { ttl?: number }>(cacheKey)
  const freshCached = pickFreshEntry(cached)

  if (config.overrides.customerApiEndpoint) {
    return {
      graphqlApi: config.overrides.customerApiEndpoint,
      source: "override",
    }
  }

  if (freshCached) {
    return { graphqlApi: freshCached.data.graphqlApi, mcpApi: freshCached.data.mcpApi, source: "cache" }
  }

  const discoveryUrl = `https://${domain}/.well-known/customer-account-api`

  try {
    const result = await fetchWellKnownWithRetry<CustomerApiWellKnown>(discoveryUrl, cached?.etag)
    if (result.status === "not-modified" && cached) {
      const renewed: CachePayload<CustomerApiDiscoveryResult & { ttl?: number }> = {
        data: { ...cached.data, source: cached.data.source ?? "cache" },
        etag: cached.etag,
        expiresAt: Date.now() + (cached.data?.ttl ?? TTL_MS),
      }
      setCacheEntry(cacheKey, renewed)
      return { graphqlApi: renewed.data.graphqlApi, mcpApi: renewed.data.mcpApi, source: renewed.data.source ?? "cache" }
    }
    if (result.status === "ok") {
      const mapped = mapCustomerApiResponse(result.json, "discovery")
      const payload: CachePayload<CustomerApiDiscoveryResult & { ttl?: number }> = {
        data: mapped,
        etag: result.etag,
        expiresAt: Date.now() + Math.min(Math.max(mapped.ttl, FALLBACK_TTL_MS), TTL_MS),
      }
      setCacheEntry(cacheKey, payload)
      return { graphqlApi: mapped.graphqlApi, mcpApi: mapped.mcpApi, source: mapped.source }
    }
    throw new DiscoveryError("Unexpected discovery response state")
  } catch (error) {
    if (cached) {
      return { graphqlApi: cached.data.graphqlApi, mcpApi: cached.data.mcpApi, source: cached.data.source ?? "cache" }
    }
    throw error instanceof Error ? error : new Error("Customer Account API discovery failed")
  }
}

export const __testables = {
  normalizeDiscoveryUrl,
  parseRetryAfter,
  getCacheKey,
}
