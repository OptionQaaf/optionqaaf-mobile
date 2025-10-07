import { getShopifyCustomerConfig, sanitizeShopDomain } from "./config"
import { getCustomerApiConfig } from "./discovery"
import { CustomerApiError } from "./errors"
import type { CustomerApiConfig } from "./types"
import { getValidAccessToken, setGraphqlEndpointForSession, updateStoredCustomerSession } from "./tokens"

type FetchGraphQL = <TResult, TVariables = Record<string, unknown>>(
  operationName: string,
  query: string,
  variables?: TVariables,
) => Promise<TResult>

export type CustomerGraphQLClient = {
  fetchGraphQL: FetchGraphQL
}

type GraphQLResponse<T> = {
  data?: T
  errors?: Array<{ message?: string; extensions?: Record<string, any> }>
}

function createPayload(operationName: string, query: string, variables?: unknown) {
  return JSON.stringify({
    operationName,
    query,
    variables: variables ?? {},
  })
}

async function performRequest<T>(
  endpoint: string,
  token: string,
  payload: string,
): Promise<{ response: Response; body: GraphQLResponse<T> }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: payload,
  })
  let body: GraphQLResponse<T>
  try {
    body = (await response.json()) as GraphQLResponse<T>
  } catch {
    body = { data: undefined, errors: undefined }
  }
  return { response, body }
}

function buildGraphQLError<T>(
  endpoint: string,
  response: Response,
  body: GraphQLResponse<T>,
): CustomerApiError {
  const status = response.status
  const message =
    body.errors
      ?.map((err) => err?.message)
      .filter(Boolean)
      .join("; ") ||
    (status === 404
      ? "Customer Accounts not enabled for this shop or misconfigured sales channel. Please verify Admin → Settings → Customer accounts is ON, and Headless/Hydrogen sales channel Customer Account API is configured. Also ensure you used the discovered GraphQL endpoint."
      : `Customer GraphQL request failed (${status})`)
  return new CustomerApiError(message, status, body.errors, endpoint)
}

export async function createCustomerGraphQLClient(rawShopDomain?: string): Promise<CustomerGraphQLClient> {
  const { shopDomain } = getShopifyCustomerConfig()
  const domain = sanitizeShopDomain(rawShopDomain || shopDomain)
  let discovery: CustomerApiConfig | null = null

  async function ensureDiscovery(force?: boolean) {
    discovery = await getCustomerApiConfig(domain, force)
    await setGraphqlEndpointForSession(discovery.graphqlApi)
    return discovery
  }

  await ensureDiscovery()

  async function execute<T, V>(operationName: string, query: string, variables?: V): Promise<T> {
    let attempt = 0
    let lastError: CustomerApiError | null = null
    let endpoint = discovery?.graphqlApi || (await ensureDiscovery()).graphqlApi

    while (attempt < 3) {
      attempt += 1
      const { accessToken } = await getValidAccessToken(domain, {
        forceRefresh: attempt > 1 && lastError?.status === 401,
      })
      const payload = createPayload(operationName, query, variables)
      const { response, body } = await performRequest<T>(endpoint, accessToken, payload)

      if (response.ok && body.data) {
        if (body.errors && body.errors.length > 0) {
          throw buildGraphQLError(endpoint, response, body)
        }
        return body.data
      }

      const error = buildGraphQLError(endpoint, response, body)

      if (response.status === 401 || response.status === 403) {
        lastError = error
        if (attempt < 3) continue
      }

      if (response.status === 404 && attempt < 3) {
        const refreshed = await ensureDiscovery(true)
        endpoint = refreshed.graphqlApi
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[Shopify][Customer] GraphQL 404 – re-discovered endpoint", endpoint)
        }
        continue
      }

      lastError = error
      break
    }

    if (lastError) throw lastError
    throw new CustomerApiError("Customer GraphQL request failed", 500)
  }

  return {
    fetchGraphQL: execute,
  }
}

export async function invalidateSessionEndpoints(): Promise<void> {
  await updateStoredCustomerSession((current) => current)
}

export { CustomerApiError }
