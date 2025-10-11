import { SHOPIFY_API_VERSION } from "../env"
import { getCustomerApiEndpoint } from "./discovery"
import { CUSTOMER_CLIENT_ID, SHOP_DOMAIN_HEADER, SHOP_ID } from "./env"
import { CustomerApiError } from "./errors"
import { getValidAccessToken, updateStoredCustomerSession } from "./tokens"

export type GraphQLResponse<T> = {
  data?: T
  errors?: Array<{ message?: string; [key: string]: any }>
}

type ExecuteOptions = {
  attempt?: number
  forceEndpointRefresh?: boolean
  forceTokenRefresh?: boolean
  operationName?: string
}

async function executeCustomerGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: ExecuteOptions,
): Promise<{ json: GraphQLResponse<T>; endpoint: string }> {
  const attempt = options?.attempt ?? 0
  const endpoint = await getCustomerApiEndpoint({ forceRefresh: options?.forceEndpointRefresh })

  await updateStoredCustomerSession((current) => ({ ...current, graphqlEndpoint: endpoint }))

  const { accessToken } = await getValidAccessToken({ forceRefresh: options?.forceTokenRefresh })

  const payload: Record<string, unknown> = {
    query,
    variables: variables ?? {},
  }
  if (options?.operationName) {
    payload.operationName = options.operationName
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Shopify-Api-Client-Id": CUSTOMER_CLIENT_ID,
    "Shopify-Shop-Id": String(SHOP_ID),
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (SHOPIFY_API_VERSION) {
    headers["Shopify-Api-Version"] = SHOPIFY_API_VERSION
  }
  if (SHOP_DOMAIN_HEADER) {
    headers["Shopify-Shop-Domain"] = SHOP_DOMAIN_HEADER
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    if (res.status === 401 || res.status === 403) {
      if (attempt >= 1) {
        throw new CustomerApiError(`[CAAPI] ${res.status} ${res.statusText}`, res.status, text ? [{ message: text }] : undefined, endpoint)
      }
      return executeCustomerGraphQL<T>(query, variables, {
        ...options,
        attempt: attempt + 1,
        forceTokenRefresh: true,
      })
    }

    if (res.status === 404) {
      if (typeof __DEV__ === "undefined" || __DEV__) {
        console.warn("[CAAPI] HTTP error", res.status, "endpoint:", endpoint, "body:", text)
      }
      if (attempt >= 1) {
        throw new CustomerApiError(
          "[CAAPI] 404 Not Found (check discovery source and Shopify-Shop-Id)",
          res.status,
          text ? [{ message: text }] : undefined,
          endpoint,
        )
      }
      return executeCustomerGraphQL<T>(query, variables, {
        ...options,
        attempt: attempt + 1,
        forceEndpointRefresh: true,
      })
    }

    throw new CustomerApiError(
      `[CAAPI] ${res.status} ${res.statusText}`,
      res.status,
      text ? [{ message: text }] : undefined,
      endpoint,
    )
  }

  let json: GraphQLResponse<T>
  try {
    json = (await res.json()) as GraphQLResponse<T>
  } catch {
    throw new CustomerApiError("[CAAPI] Invalid JSON response", res.status, undefined, endpoint)
  }

  return { json, endpoint }
}

export async function customerQuery<T = any>(
  query: string,
  variables?: Record<string, any>,
): Promise<GraphQLResponse<T>> {
  const { json } = await executeCustomerGraphQL<T>(query, variables)
  return json
}

type FetchGraphQL = <TResult, TVariables = Record<string, unknown>>(
  operationName: string,
  query: string,
  variables?: TVariables,
) => Promise<TResult>

export type CustomerGraphQLClient = {
  fetchGraphQL: FetchGraphQL
}

function buildGraphQLError<T>(
  endpoint: string,
  body: GraphQLResponse<T>,
  status = 200,
): CustomerApiError {
  const message =
    body.errors
      ?.map((err) => err?.message)
      .filter(Boolean)
      .join("; ") || "Customer GraphQL request failed"
  return new CustomerApiError(message, status, body.errors, endpoint)
}

export async function createCustomerGraphQLClient(): Promise<CustomerGraphQLClient> {
  return {
    fetchGraphQL: async (operationName, query, variables) => {
      const { json, endpoint } = await executeCustomerGraphQL<any>(
        query,
        variables as Record<string, unknown> | undefined,
        { operationName },
      )

      if (json.errors && json.errors.length > 0) {
        throw buildGraphQLError(endpoint, json)
      }

      if (!json.data) {
        throw buildGraphQLError(endpoint, json)
      }

      return json.data as any
    },
  }
}

export async function invalidateSessionEndpoints(): Promise<void> {
  await updateStoredCustomerSession((current) => current)
}

export { CustomerApiError }
