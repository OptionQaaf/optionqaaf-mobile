import { getCustomerAuthConfig } from "@/lib/config/customerAuth"
import { discoverCustomerAPI } from "@/lib/customerAuth/discovery"
import {
  clearSession,
  getCachedSession,
  getFreshAccessToken,
  loadSession,
  setDiscoverySource,
} from "@/lib/customerAuth/session"

const GRAPHQL_ENDPOINT_CACHE = new Map<string, string>()
let inflightDiscovery: Promise<string> | null = null

export class CustomerApiError extends Error {
  status?: number
  endpoint: string
  errors?: unknown

  constructor(message: string, endpoint: string, status?: number, errors?: unknown) {
    super(message)
    this.name = "CustomerApiError"
    this.endpoint = endpoint
    this.status = status
    this.errors = errors
  }
}

export class InvalidTokenError extends CustomerApiError {}
export class ThrottledError extends CustomerApiError {}
export class PermissionError extends CustomerApiError {}

async function resolveEndpoint(): Promise<string> {
  const config = getCustomerAuthConfig()
  const cacheKey = config.shopDomain
  if (GRAPHQL_ENDPOINT_CACHE.has(cacheKey)) {
    return GRAPHQL_ENDPOINT_CACHE.get(cacheKey) as string
  }
  if (!inflightDiscovery) {
    inflightDiscovery = (async () => {
      const result = await discoverCustomerAPI(config.shopDomain)
      GRAPHQL_ENDPOINT_CACHE.set(cacheKey, result.graphqlApi)
      setDiscoverySource(result.source)
      return result.graphqlApi
    })().finally(() => {
      inflightDiscovery = null
    })
  }
  if (inflightDiscovery) {
    return inflightDiscovery
  }
  return GRAPHQL_ENDPOINT_CACHE.get(cacheKey) as string
}

async function executeGraphQL<T>(query: string, variables?: Record<string, unknown>, attempt = 0): Promise<T> {
  const config = getCustomerAuthConfig()
  const endpoint = await resolveEndpoint()
  const token = await getFreshAccessToken()

  if (!token) {
    await clearSession()
    throw new InvalidTokenError("Customer session unavailable", endpoint, 401)
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "User-Agent": config.userAgent,
    "Shopify-Shop-Id": config.shopId,
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    headers["Shopify-GraphQL-Cost-Debug"] = "1"
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  })

  if (response.status === 401 && attempt === 0) {
    await getFreshAccessToken(Number.MAX_SAFE_INTEGER)
    const refreshedToken = await getFreshAccessToken()
    if (refreshedToken) {
      return executeGraphQL<T>(query, variables, attempt + 1)
    }
    await clearSession()
    throw new InvalidTokenError("Customer access token rejected", endpoint, response.status)
  }

  if (response.status === 403) {
    throw new PermissionError("Customer access forbidden", endpoint, response.status)
  }

  if (response.status === 429) {
    throw new ThrottledError("Customer API throttled", endpoint, response.status)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new CustomerApiError(
      text || `Customer API request failed (${response.status})`,
      endpoint,
      response.status,
      text,
    )
  }

  const json = await response.json().catch(() => null)
  if (!json || typeof json !== "object") {
    throw new CustomerApiError("Invalid JSON response from Customer API", endpoint)
  }

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    const first = json.errors[0] ?? {}
    const code = first?.extensions?.code
    if (code === "THROTTLED") {
      throw new ThrottledError("Customer API throttled", endpoint, response.status, json.errors)
    }
    if (code === "UNAUTHENTICATED") {
      await clearSession()
      throw new InvalidTokenError("Customer session expired", endpoint, response.status, json.errors)
    }
    if (code === "FORBIDDEN") {
      throw new PermissionError("Customer API permission denied", endpoint, response.status, json.errors)
    }
    throw new CustomerApiError("Customer API returned errors", endpoint, response.status, json.errors)
  }

  if (!json.data) {
    throw new CustomerApiError("Customer API response missing data", endpoint, response.status)
  }

  return json.data as T
}

export async function postGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  try {
    return await executeGraphQL<T>(query, variables)
  } catch (error) {
    if (error instanceof CustomerApiError) {
      throw error
    }
    throw new CustomerApiError(
      error instanceof Error ? error.message : "Unknown Customer API error",
      GRAPHQL_ENDPOINT_CACHE.values().next().value ?? "",
    )
  }
}

export async function ensureSession(): Promise<void> {
  const session = getCachedSession() ?? (await loadSession())
  if (!session) return
}
