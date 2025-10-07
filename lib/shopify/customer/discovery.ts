import { kv } from "@/lib/storage/mmkv"

import { getShopifyCustomerConfig, sanitizeShopDomain } from "./config"
import { DiscoveryError } from "./errors"
import type { CustomerApiConfig, OpenIdConfig } from "./types"

type CachedEntry<T> = {
  value: T
  expiresAt: number
  fetchedAt: number
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const STALE_GRACE_MS = 5 * 60 * 1000

const inflight = new Map<string, Promise<any>>()

function cacheKey(type: "openid" | "customer", shopDomain: string) {
  return `shopify.customer.discovery:${type}:v1:${shopDomain}`
}

function readCache<T>(key: string): { entry: CachedEntry<T>; expired: boolean } | null {
  const raw = kv.get(key)
  if (!raw) return null
  try {
    const entry = JSON.parse(raw) as CachedEntry<T>
    const expired = entry.expiresAt <= Date.now()
    return { entry, expired }
  } catch {
    kv.del(key)
    return null
  }
}

function writeCache<T>(key: string, value: T) {
  const entry: CachedEntry<T> = {
    value,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
  kv.set(key, JSON.stringify(entry))
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  })
  if (!response.ok) {
    const message = await response.text().catch(() => "")
    throw new DiscoveryError(`Discovery failed (${response.status})${message ? `: ${message}` : ""}`, response.status)
  }
  return (await response.json()) as T
}

async function resolveWithCache<T>(
  type: "openid" | "customer",
  shopDomain: string,
  fetcher: () => Promise<T>,
  forceRefresh?: boolean,
): Promise<T> {
  const key = cacheKey(type, shopDomain)
  const cached = readCache<T>(key)

  if (!forceRefresh && cached && !cached.expired) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log(`[Shopify][Discovery] ${type} cache hit for ${shopDomain}`)
    }
    return cached.entry.value
  }

  if (!forceRefresh && cached) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log(`[Shopify][Discovery] ${type} cache stale for ${shopDomain} – serving stale & revalidating`)
    }
    void revalidate(key, fetcher)
    return cached.entry.value
  }

  const keyInflight = `${type}:${shopDomain}`
  let task = inflight.get(keyInflight) as Promise<T> | undefined
  if (!task) {
    task = (async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 7000)
      try {
        const value = await fetcher()
        writeCache(key, value)
        return value
      } finally {
        clearTimeout(timeout)
        inflight.delete(keyInflight)
      }
    })()
    inflight.set(keyInflight, task)
  }

  try {
    const value = await task
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log(`[Shopify][Discovery] ${type} fetched from network for ${shopDomain}`)
    }
    return value
  } catch (error) {
    inflight.delete(keyInflight)
    if (cached && Date.now() - cached.entry.fetchedAt < CACHE_TTL_MS + STALE_GRACE_MS) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(`[Shopify][Discovery] ${type} fetch failed – using stale cache`, error)
      }
      return cached.entry.value
    }
    throw error
  }
}

async function revalidate<T>(key: string, fetcher: () => Promise<T>) {
  try {
    const value = await fetcher()
    writeCache(key, value)
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[Shopify][Discovery] cache refreshed")
    }
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[Shopify][Discovery] background refresh failed", error)
    }
  }
}

export async function getOpenIdConfig(rawShopDomain?: string, forceRefresh = false): Promise<OpenIdConfig> {
  const { shopDomain, authorizationEndpointOverride, tokenEndpointOverride, logoutEndpointOverride } =
    getShopifyCustomerConfig()
  const domain = sanitizeShopDomain(rawShopDomain || shopDomain)

  if (authorizationEndpointOverride && tokenEndpointOverride) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[Shopify][Discovery] Using OpenID overrides")
    }
    return {
      authorizationEndpoint: authorizationEndpointOverride,
      tokenEndpoint: tokenEndpointOverride,
      endSessionEndpoint: logoutEndpointOverride,
    }
  }

  const config = await resolveWithCache(
    "openid",
    domain,
    async () => {
      const url = `https://${domain}/.well-known/openid-configuration`
      const json = await fetchJson<{
        authorization_endpoint: string
        token_endpoint: string
        end_session_endpoint?: string
      }>(url)
      return {
        authorizationEndpoint: json.authorization_endpoint,
        tokenEndpoint: json.token_endpoint,
        endSessionEndpoint: json.end_session_endpoint,
      }
    },
    forceRefresh,
  )

  if (logoutEndpointOverride) {
    return { ...config, endSessionEndpoint: logoutEndpointOverride }
  }

  return config
}

export async function getCustomerApiConfig(rawShopDomain?: string, forceRefresh = false): Promise<CustomerApiConfig> {
  const { shopDomain, graphqlEndpointOverride } = getShopifyCustomerConfig()
  const domain = sanitizeShopDomain(rawShopDomain || shopDomain)

  if (graphqlEndpointOverride) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[Shopify][Discovery] Using GraphQL override")
    }
    return { graphqlApi: graphqlEndpointOverride }
  }

  return resolveWithCache(
    "customer",
    domain,
    async () => {
      const url = `https://${domain}/.well-known/customer-account-api`
      const json = await fetchJson<{ graphql_api: string; mcp_api?: string }>(url)
      return { graphqlApi: json.graphql_api, mcpApi: json.mcp_api }
    },
    forceRefresh,
  )
}
