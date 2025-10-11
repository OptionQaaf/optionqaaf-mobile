import { kv } from "@/lib/storage/mmkv"

import { CAAPI_GRAPHQL_OVERRIDE, OIDC_ISSUER, SHOP_DOMAIN_FOR_LOGS, SHOP_ID } from "./env"
import { DiscoveryError } from "./errors"
import { getShopifyCustomerConfig, sanitizeShopDomain } from "./config"

const ENDPOINT_CACHE_KEY = `shopify.customer.caapi.endpoint:${SHOP_ID}`
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 // 24 hours
const MIN_TTL_MS = 1000 * 60 * 5 // 5 minutes
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = [0, 400, 1600]

const loggedEndpoints = new Set<string>()
let nextDiscoveryAllowedAt = 0
let inflightDiscovery: Promise<EndpointCacheRecord> | null = null

function logEndpoint(source: string, url: string) {
  const key = `${source}:${url}`
  if (loggedEndpoints.has(key)) return
  loggedEndpoints.add(key)
  if (typeof __DEV__ === "undefined" || __DEV__) {
    console.log(`[CAAPI][discovery] ${source} endpoint → ${url}`)
  }
}

type EndpointCacheRecord = {
  url: string
  fetchedAt: number
  ttlMs: number
}

type CustomerAccountWellKnown = {
  graphql?: string
  graphql_api?: string
  endpoints?: {
    graphql?: string
  }
  ttl_ms?: number
  ttl_seconds?: number
  ttl?: number
  cache_control?: {
    max_age?: number
  }
  cacheControl?: {
    maxAge?: number
  }
  cache?: {
    ttl_ms?: number
    ttl_seconds?: number
  }
}

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null
  const seconds = Number(headerValue)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000)
  }
  const asDate = Date.parse(headerValue)
  if (!Number.isNaN(asDate)) {
    const ms = asDate - Date.now()
    return ms > 0 ? ms : null
  }
  return null
}

function readCache(): EndpointCacheRecord | null {
  const raw = kv.get(ENDPOINT_CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as EndpointCacheRecord
    if (!parsed || typeof parsed.url !== "string") return null
    if (typeof parsed.ttlMs !== "number" || !Number.isFinite(parsed.ttlMs)) {
      parsed.ttlMs = DEFAULT_TTL_MS
    }
    return parsed
  } catch {
    kv.del(ENDPOINT_CACHE_KEY)
    return null
  }
}

function writeCache(record: EndpointCacheRecord) {
  kv.set(ENDPOINT_CACHE_KEY, JSON.stringify(record))
}

function cacheIsFresh(record: EndpointCacheRecord): boolean {
  return record.fetchedAt + record.ttlMs > Date.now()
}

function jitterDelay(base: number): number {
  if (base <= 0) return 0
  const spread = Math.min(500, base * 0.25)
  return Math.max(0, Math.round(base + (Math.random() - 0.5) * 2 * spread))
}

function ttlFromJson(json: CustomerAccountWellKnown): number {
  const ttlCandidates = [
    json.ttl_ms,
    json.cache?.ttl_ms,
    json.cacheControl?.maxAge ? json.cacheControl.maxAge * 1000 : undefined,
    json.cache_control?.max_age ? json.cache_control.max_age * 1000 : undefined,
    json.ttl_seconds ? json.ttl_seconds * 1000 : undefined,
    json.cache?.ttl_seconds ? json.cache.ttl_seconds * 1000 : undefined,
    json.ttl ? json.ttl * 1000 : undefined,
  ]

  for (const candidate of ttlCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate
    }
  }

  return DEFAULT_TTL_MS
}

function extractGraphqlEndpoint(json: CustomerAccountWellKnown): string {
  const endpoint =
    typeof json.graphql === "string"
      ? json.graphql
      : typeof json.graphql_api === "string"
        ? json.graphql_api
        : typeof json.endpoints?.graphql === "string"
          ? json.endpoints.graphql
          : null

  if (!endpoint) {
    throw new DiscoveryError("Customer Account API discovery failed: missing graphql endpoint in well-known response")
  }

  return endpoint
}

async function fetchCustomerAccountDocument(candidate: {
  url: string
  source: string
}): Promise<CustomerAccountWellKnown & { url: string; ttlMs: number; source: string }> {
  const response = await fetch(candidate.url, {
    method: "GET",
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"))
    throw new DiscoveryError(
      `Customer Account API discovery failed (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
      { source: candidate.source, body: detail, retryAfterMs },
    )
  }

  const json = (await response.json()) as CustomerAccountWellKnown
  const url = extractGraphqlEndpoint(json)
  const ttlMs = Math.max(MIN_TTL_MS, Math.min(ttlFromJson(json), DEFAULT_TTL_MS))
  return { ...json, url, ttlMs, source: candidate.source }
}

async function requestCustomerAccountWellKnown(shopId: number): Promise<CustomerAccountWellKnown & {
  url: string
  ttlMs: number
  source: string
}> {
  const candidates: Array<{ url: string; source: string }> = [
    {
      url: `https://shopify.com/authentication/${shopId}/.well-known/customer-account-api`,
      source: "issuer",
    },
  ]

  const { shopDomain } = getShopifyCustomerConfig()
  const fallbackDomain = shopDomain || SHOP_DOMAIN_FOR_LOGS || null
  if (fallbackDomain) {
    candidates.push({
      url: `https://${sanitizeShopDomain(fallbackDomain)}/.well-known/customer-account-api`,
      source: "shop-domain",
    })
  }

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await fetchCustomerAccountDocument(candidate)
    } catch (error) {
      lastError = error
      if (typeof __DEV__ === "undefined" || __DEV__) {
        const message =
          error instanceof DiscoveryError
            ? `${error.message}${error.status ? ` [${error.status}]` : ""}`
            : String(error)
        const retryAfter =
          error instanceof DiscoveryError
            ? (error.cause as { retryAfterMs?: number } | undefined)?.retryAfterMs ?? null
            : null
        const suffix = retryAfter ? ` (retry in ${Math.ceil(retryAfter)}ms)` : ""
        console.warn(`[CAAPI][discovery] ${candidate.source} lookup failed → ${message}${suffix}`)
      }
    }
  }

  if (lastError instanceof DiscoveryError) {
    throw lastError
  }

  throw new DiscoveryError("Customer Account API discovery failed", undefined, lastError)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function performDiscovery(): Promise<EndpointCacheRecord> {
  let attempt = 0
  let nextDelay = 0
  let lastError: unknown = null

  while (attempt < MAX_RETRIES) {
    if (Date.now() < nextDiscoveryAllowedAt) {
      await delay(nextDiscoveryAllowedAt - Date.now())
    } else if (nextDelay > 0) {
      await delay(nextDelay)
    }

    try {
      const result = await requestCustomerAccountWellKnown(SHOP_ID)
      const ttlMs = Math.max(MIN_TTL_MS, Math.min(result.ttlMs, DEFAULT_TTL_MS))
      const record: EndpointCacheRecord = {
        url: result.url,
        ttlMs,
        fetchedAt: Date.now(),
      }
      writeCache(record)
      logEndpoint(result.source, result.url)
      nextDiscoveryAllowedAt = 0
      return record
    } catch (error) {
      lastError = error
      attempt += 1

      if (error instanceof DiscoveryError && error.status === 429) {
        const retryAfterMs = typeof (error.cause as { retryAfterMs?: number } | undefined)?.retryAfterMs === "number"
          ? (error.cause as { retryAfterMs?: number }).retryAfterMs
          : null
        const backoff = jitterDelay(retryAfterMs ?? 5000)
        nextDiscoveryAllowedAt = Date.now() + backoff
        nextDelay = backoff
        continue
      }

      const backoffIndex = Math.min(attempt, BASE_BACKOFF_MS.length - 1)
      nextDelay = jitterDelay(BASE_BACKOFF_MS[backoffIndex])
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new DiscoveryError("Customer Account API discovery failed after retries")
}

function getDiscoveryTask(): Promise<EndpointCacheRecord> {
  if (inflightDiscovery) {
    return inflightDiscovery
  }

  const task = performDiscovery().finally(() => {
    if (inflightDiscovery === task) {
      inflightDiscovery = null
    }
  })

  inflightDiscovery = task
  return task
}

export async function getCustomerApiEndpoint(options?: { forceRefresh?: boolean }): Promise<string> {
  if (CAAPI_GRAPHQL_OVERRIDE) {
    logEndpoint("override", CAAPI_GRAPHQL_OVERRIDE)
    return CAAPI_GRAPHQL_OVERRIDE
  }

  const cached = readCache()
  if (!options?.forceRefresh && cached && cacheIsFresh(cached)) {
    logEndpoint("cached", cached.url)
    return cached.url
  }

  if (!options?.forceRefresh && cached) {
    if (!inflightDiscovery) {
      void getDiscoveryTask().catch(() => undefined)
    }
    logEndpoint("stale", cached.url)
    return cached.url
  }

  try {
    const record = await getDiscoveryTask()
    return record.url
  } catch (error) {
    const fallback = readCache()
    if (fallback) {
      if (typeof __DEV__ === "undefined" || __DEV__) {
        console.warn("[CAAPI][discovery] Using cached endpoint after failure", error)
      }
      return fallback.url
    }
    if (error instanceof DiscoveryError) {
      throw error
    }
    throw new DiscoveryError("Customer Account API discovery failed", undefined, error)
  }
}

export async function getCustomerAccountWellKnown(
  shopId: number,
): Promise<CustomerAccountWellKnown & { url: string; ttlMs: number; source: string }> {
  return requestCustomerAccountWellKnown(shopId)
}

export function getCustomerApiConfigOverride(): { graphql_api: string } | null {
  const { graphqlEndpointOverride } = getShopifyCustomerConfig()
  return graphqlEndpointOverride ? { graphql_api: graphqlEndpointOverride } : null
}

export function getOpenIdConfigOverride(): {
  authorization_endpoint: string
  token_endpoint: string
  end_session_endpoint?: string | null
} | null {
  const { authorizationEndpointOverride, tokenEndpointOverride, logoutEndpointOverride } = getShopifyCustomerConfig()
  if (!authorizationEndpointOverride || !tokenEndpointOverride) return null
  return {
    authorization_endpoint: authorizationEndpointOverride,
    token_endpoint: tokenEndpointOverride,
    end_session_endpoint: logoutEndpointOverride ?? null,
  }
}

export function getIssuerForLogging(): string {
  return OIDC_ISSUER
}

export function getShopDomainForLogging(): string | null {
  return SHOP_DOMAIN_FOR_LOGS || null
}
