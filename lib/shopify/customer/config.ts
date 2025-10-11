import * as AuthSession from "expo-auth-session"

import {
  CAAPI_GRAPHQL_OVERRIDE,
  CUSTOMER_CLIENT_ID,
  OIDC_ISSUER,
  SHOP_DOMAIN_FOR_LOGS,
  SHOP_ID,
  verifyCustomerEnv,
} from "./env"

type ShopifyCustomerConfig = {
  shopId: number
  issuer: string
  shopDomain?: string | null
  clientId: string
  scopes: string
  redirectUri: string
  graphqlEndpointOverride?: string
  authorizationEndpointOverride?: string
  tokenEndpointOverride?: string
  logoutEndpointOverride?: string
}

let cachedConfig: ShopifyCustomerConfig | null = null

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function sanitizeShopDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

function buildRedirectFromScheme(scheme: string, path: string): string {
  const normalizedScheme = scheme.replace(/:\/\/.*/, "")
  const normalizedPath = path.replace(/^\/+/, "")
  return `${normalizedScheme}://${normalizedPath}`
}

export function getShopifyCustomerConfig(): ShopifyCustomerConfig {
  if (cachedConfig) return cachedConfig

  verifyCustomerEnv()

  const explicitDomain = readEnv("EXPO_PUBLIC_SHOPIFY_DOMAIN") || readEnv("EXPO_PUBLIC_SHOPIFY_SHOP_DOMAIN")

  const scopes = readEnv("EXPO_PUBLIC_SHOPIFY_SCOPES") || "openid email customer-account-api:full"

  const explicitRedirect = readEnv("EXPO_PUBLIC_SHOPIFY_CUSTOMER_REDIRECT_URI")
  const scheme = readEnv("EXPO_PUBLIC_SHOPIFY_AUTH_SCHEME")
  const redirectUri =
    explicitRedirect ||
    (scheme
      ? buildRedirectFromScheme(scheme, "callback")
      : AuthSession.makeRedirectUri({ path: "customer/callback" }))

  const graphqlEndpointOverride = CAAPI_GRAPHQL_OVERRIDE || undefined
  const authorizationEndpointOverride =
    readEnv("EXPO_PUBLIC_SHOPIFY_AUTH_ENDPOINT") || readEnv("EXPO_PUBLIC_SHOPIFY_OPENID_AUTHORIZATION_ENDPOINT")
  const tokenEndpointOverride =
    readEnv("EXPO_PUBLIC_SHOPIFY_TOKEN_ENDPOINT") || readEnv("EXPO_PUBLIC_SHOPIFY_OPENID_TOKEN_ENDPOINT")
  const logoutEndpointOverride =
    readEnv("EXPO_PUBLIC_SHOPIFY_LOGOUT_ENDPOINT") || readEnv("EXPO_PUBLIC_SHOPIFY_OPENID_LOGOUT_ENDPOINT")

  cachedConfig = {
    shopId: SHOP_ID,
    issuer: OIDC_ISSUER,
    shopDomain: explicitDomain ? sanitizeShopDomain(explicitDomain) : SHOP_DOMAIN_FOR_LOGS || null,
    clientId: CUSTOMER_CLIENT_ID,
    scopes,
    redirectUri,
    graphqlEndpointOverride,
    authorizationEndpointOverride,
    tokenEndpointOverride,
    logoutEndpointOverride,
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const slug = cachedConfig.shopDomain ? cachedConfig.shopDomain : `shop-id:${cachedConfig.shopId}`
    console.log("[Shopify][Customer] Loaded config for", slug)
  }

  return cachedConfig
}

export { sanitizeShopDomain }
