import * as Linking from "expo-linking"

type ShopifyCustomerConfig = {
  shopDomain: string
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

export function getShopifyCustomerConfig(): ShopifyCustomerConfig {
  if (cachedConfig) return cachedConfig

  const explicitDomain = readEnv("EXPO_PUBLIC_SHOPIFY_SHOP_DOMAIN") || readEnv("EXPO_PUBLIC_SHOPIFY_DOMAIN")
  const explicitClientId = readEnv("EXPO_PUBLIC_SHOPIFY_CLIENT_ID") || readEnv("EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID")

  if (!explicitDomain) {
    throw new Error("Missing EXPO_PUBLIC_SHOPIFY_SHOP_DOMAIN")
  }
  if (!explicitClientId) {
    throw new Error("Missing EXPO_PUBLIC_SHOPIFY_CLIENT_ID")
  }

  const scopes = readEnv("EXPO_PUBLIC_SHOPIFY_SCOPES") || "openid email customer-account-api:full"

  const scheme = readEnv("EXPO_PUBLIC_SHOPIFY_AUTH_SCHEME")
  const redirectUri = scheme ?? Linking.createURL("customer/callback")

  const graphqlEndpointOverride = readEnv("EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_ENDPOINT")
  const authorizationEndpointOverride =
    readEnv("EXPO_PUBLIC_SHOPIFY_AUTH_ENDPOINT") || readEnv("EXPO_PUBLIC_SHOPIFY_OPENID_AUTHORIZATION_ENDPOINT")
  const tokenEndpointOverride =
    readEnv("EXPO_PUBLIC_SHOPIFY_TOKEN_ENDPOINT") || readEnv("EXPO_PUBLIC_SHOPIFY_OPENID_TOKEN_ENDPOINT")
  const logoutEndpointOverride =
    readEnv("EXPO_PUBLIC_SHOPIFY_LOGOUT_ENDPOINT") || readEnv("EXPO_PUBLIC_SHOPIFY_OPENID_LOGOUT_ENDPOINT")

  cachedConfig = {
    shopDomain: sanitizeShopDomain(explicitDomain),
    clientId: explicitClientId,
    scopes,
    redirectUri,
    graphqlEndpointOverride,
    authorizationEndpointOverride,
    tokenEndpointOverride,
    logoutEndpointOverride,
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[Shopify][Customer] Loaded config for", cachedConfig.shopDomain)
  }

  return cachedConfig
}

export { sanitizeShopDomain }
