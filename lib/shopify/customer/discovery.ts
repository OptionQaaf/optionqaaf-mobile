// lib/shopify/customer/discovery.ts
import {
  GRAPHQL_OVERRIDE,
  SHOPIFY_OPENID_AUTHORIZATION_ENDPOINT,
  SHOPIFY_OPENID_LOGOUT_ENDPOINT,
  SHOPIFY_OPENID_TOKEN_ENDPOINT,
  SHOPIFY_DOMAIN as STOREFRONT_DOMAIN,
} from "@/lib/shopify/env"

export type OpenIdConfig = {
  authorization_endpoint: string
  token_endpoint: string
  end_session_endpoint: string
  jwks_uri?: string
  issuer?: string
}

export type CustomerApiConfig = {
  graphql?: { endpoint: string }
}

let memoOIDC: OpenIdConfig | undefined
let memoCAC: CustomerApiConfig | undefined

// Prefer your env overrides if present; otherwise use storefront discovery.
export async function fetchOpenIdConfig(): Promise<OpenIdConfig> {
  if (memoOIDC) return memoOIDC

  if (SHOPIFY_OPENID_AUTHORIZATION_ENDPOINT && SHOPIFY_OPENID_TOKEN_ENDPOINT && SHOPIFY_OPENID_LOGOUT_ENDPOINT) {
    memoOIDC = {
      authorization_endpoint: SHOPIFY_OPENID_AUTHORIZATION_ENDPOINT,
      token_endpoint: SHOPIFY_OPENID_TOKEN_ENDPOINT,
      end_session_endpoint: SHOPIFY_OPENID_LOGOUT_ENDPOINT,
    }
    return memoOIDC
  }

  const url = `https://${STOREFRONT_DOMAIN}/.well-known/openid-configuration`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenID discovery failed: ${res.status}`)

  const json = await res.json()
  memoOIDC = {
    authorization_endpoint: json.authorization_endpoint,
    token_endpoint: json.token_endpoint,
    end_session_endpoint: json.end_session_endpoint,
    jwks_uri: json.jwks_uri,
    issuer: json.issuer,
  }
  return memoOIDC
}

export async function fetchCustomerApiConfig(): Promise<CustomerApiConfig> {
  if (memoCAC) return memoCAC

  if (GRAPHQL_OVERRIDE) {
    memoCAC = { graphql: { endpoint: GRAPHQL_OVERRIDE } }
    return memoCAC
  }

  const url = `https://${STOREFRONT_DOMAIN}/.well-known/customer-account-api`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Customer API discovery failed: ${res.status} ${text}`)
  }

  const json = await res.json()

  // Normalize multiple known shapes → endpoint
  const endpoint: string | undefined =
    json?.graphql?.endpoint ||
    json?.graphql_api || // 👈 your shop returns this
    json?.graphqlEndpoint ||
    json?.endpoints?.graphql ||
    json?.customerAccountApi?.graphql?.endpoint ||
    json?.customer?.graphql?.endpoint

  memoCAC = endpoint ? { graphql: { endpoint } } : {}
  if (!endpoint) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("Customer Account discovery raw JSON (no graphql endpoint found):", JSON.stringify(json, null, 2))
    }
  }
  return memoCAC
}

export async function getCustomerGraphqlEndpoint(): Promise<string> {
  const cfg = await fetchCustomerApiConfig()
  const ep = cfg.graphql?.endpoint
  if (!ep) {
    throw new Error(
      "No customer GraphQL endpoint in discovery response. Set EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_ENDPOINT temporarily if needed.",
    )
  }
  return ep
}
