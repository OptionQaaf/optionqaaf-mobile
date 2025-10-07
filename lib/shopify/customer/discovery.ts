import { kv } from "@/lib/storage/mmkv"

export type OpenIdConfig = {
  authorization_endpoint: string
  token_endpoint: string
  end_session_endpoint?: string
  issuer?: string
  jwks_uri?: string
}

export type CustomerApiConfig = {
  graphql_api: string
  mcp_api?: string
}

let cachedOpenIdOverride: OpenIdConfig | null | undefined
let cachedCustomerOverride: CustomerApiConfig | null | undefined
let cachedCustomerEndpoint: string | null | undefined
let loggedOverrideNotice = false
let loggedEndpoint = false

function env(name: string): string | undefined {
  const value = process.env[name]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

export function getOpenIdConfigOverride(): OpenIdConfig | null {
  if (cachedOpenIdOverride !== undefined) return cachedOpenIdOverride

  const authorization = env("EXPO_PUBLIC_SHOPIFY_OPENID_AUTHORIZATION_ENDPOINT")
  const token = env("EXPO_PUBLIC_SHOPIFY_OPENID_TOKEN_ENDPOINT")
  const logout = env("EXPO_PUBLIC_SHOPIFY_OPENID_LOGOUT_ENDPOINT")
  const issuer = env("EXPO_PUBLIC_SHOPIFY_OPENID_ISSUER")
  const jwks = env("EXPO_PUBLIC_SHOPIFY_OPENID_JWKS_URI")

  if (authorization && token) {
    cachedOpenIdOverride = {
      authorization_endpoint: authorization,
      token_endpoint: token,
      end_session_endpoint: logout,
      issuer,
      jwks_uri: jwks,
    }
  } else {
    cachedOpenIdOverride = null
  }
  return cachedOpenIdOverride
}

export function getCustomerApiConfigOverride(): CustomerApiConfig | null {
  if (cachedCustomerOverride !== undefined) return cachedCustomerOverride

  const graphql = env("EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_ENDPOINT")
  const mcp = env("EXPO_PUBLIC_SHOPIFY_CUSTOMER_MCP_ENDPOINT")

  if (graphql) {
    cachedCustomerOverride = {
      graphql_api: graphql,
      mcp_api: mcp,
    }
    cachedCustomerEndpoint = graphql
  } else {
    cachedCustomerOverride = null
    cachedCustomerEndpoint = null
  }
  return cachedCustomerOverride
}

type CachedEntry<T> = { value: T; expiresAt: number }

const CUSTOMER_ENDPOINT_CACHE_KEY = "customerAccount.api.endpoint:v1"
const CUSTOMER_ENDPOINT_TTL = 24 * 60 * 60 * 1000

export async function getCustomerApiEndpoint(): Promise<string> {
  const override = env("EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_ENDPOINT")
  if (override) {
    if (!loggedOverrideNotice && typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[CustomerAuth] Using overrides for Customer API endpoint")
      loggedOverrideNotice = true
    }
    cachedCustomerEndpoint = override
    logEndpointOnce(override)
    return override
  }

  if (cachedCustomerEndpoint) return cachedCustomerEndpoint

  const cached = readEndpointFromCache()
  if (cached && !cached.expired) {
    cachedCustomerEndpoint = cached.value
    logEndpointOnce(cached.value)
    return cached.value
  }

  const domain = env("EXPO_PUBLIC_SHOPIFY_DOMAIN")
  if (!domain) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_DOMAIN")

  const url = `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/.well-known/customer-account-api`

  const response = await fetchWithRetry(url)
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    if (cached) {
      cachedCustomerEndpoint = cached.value
      logEndpointOnce(cached.value)
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(
          `[CustomerAuth] Discovery failed (${response.status}) – using cached endpoint`,
        )
      }
      return cached.value
    }
    throw new Error(`Failed to discover customer API (${response.status})${text ? `: ${text}` : ""}`)
  }
  const data = (await response.json()) as { graphql_api: string }
  const endpoint = data.graphql_api
  cachedCustomerEndpoint = endpoint
  writeEndpointToCache(endpoint)
  logEndpointOnce(endpoint)
  return endpoint
}

async function fetchWithRetry(url: string): Promise<Response> {
  let delay = 800
  const deadline = Date.now() + 15_000
  let lastError: any

  for (let attempt = 0; attempt < 6 && Date.now() < deadline; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) return res
      if ((res.status === 429 || res.status >= 500) && Date.now() < deadline) {
        const retryAfter = res.headers.get("retry-after")
        const wait = retryAfter ? Number(retryAfter) * 1000 : delay
        await sleep(wait + Math.random() * 150)
        delay = Math.min(delay * 2, 8000)
        continue
      }
      return res
    } catch (error) {
      clearTimeout(timeout)
      lastError = error
      if (error?.name === "AbortError" && Date.now() < deadline) {
        continue
      }
      await sleep(delay + Math.random() * 150)
      delay = Math.min(delay * 2, 8000)
    }
  }
  if (lastError instanceof Response) return lastError
  throw lastError ?? new Error("Failed to fetch customer API discovery")
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readEndpointFromCache(): { value: string; expired: boolean } | null {
  try {
    const raw = kv.get(CUSTOMER_ENDPOINT_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedEntry<string>
    if (!parsed?.value) return null
    const expired = !parsed.expiresAt || Date.now() > parsed.expiresAt
    return { value: parsed.value, expired }
  } catch {
    return null
  }
}

function writeEndpointToCache(endpoint: string) {
  try {
    const entry: CachedEntry<string> = {
      value: endpoint,
      expiresAt: Date.now() + CUSTOMER_ENDPOINT_TTL,
    }
    kv.set(CUSTOMER_ENDPOINT_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // ignore cache errors
  }
}

function logEndpointOnce(endpoint: string) {
  if (loggedEndpoint || typeof __DEV__ === "undefined" || !__DEV__) return
  console.log("[CustomerAuth] GraphQL endpoint:", endpoint)
  loggedEndpoint = true
}
