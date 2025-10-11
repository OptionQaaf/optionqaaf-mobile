import { makeRedirectUri } from "expo-auth-session"
import * as Linking from "expo-linking"

export type CustomerAuthConfig = {
  shopDomain: string
  clientId: string
  shopId: string
  scopes: string
  redirectUri: string
  redirectScheme: string
  debugAuth: boolean
  userAgent: string
  fallbackAuthEndpoints: {
    authorizationEndpoint: string
    tokenEndpoint: string
    logoutEndpoint: string
  }
  overrides: {
    authorizationEndpoint?: string
    tokenEndpoint?: string
    logoutEndpoint?: string
    openIdConfigurationUrl?: string
    customerApiEndpoint?: string
  }
}

const DEFAULT_SCOPES = "openid email customer-account-api:full"
const USER_AGENT = "OptionQaaf-Mobile"

function readEnv(key: string): string | undefined {
  const value = process.env[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function coalesceEnv(keys: string[], fallback?: string): string | undefined {
  for (const key of keys) {
    const value = readEnv(key)
    if (value) return value
  }
  return fallback
}

function ensureValue(value: string | undefined, message: string): string {
  if (!value) {
    throw new Error(message)
  }
  return value
}

function resolveRedirectScheme(): string {
  const explicit = coalesceEnv([
    "EXPO_PUBLIC_OAUTH_REDIRECT_SCHEME",
    "EXPO_PUBLIC_SHOPIFY_CUSTOMER_REDIRECT_SCHEME",
  ])
  if (explicit) return explicit

  const redirectUri = readEnv("EXPO_PUBLIC_SHOPIFY_CUSTOMER_REDIRECT_URI")
  if (redirectUri) {
    try {
      const parsed = new URL(redirectUri)
      if (parsed.protocol.endsWith(":")) {
        return parsed.protocol.replace(":", "")
      }
    } catch {
      // fall through
    }
  }

  const fallback = Linking.createURL("callback")
  const scheme = fallback.split(":")[0]
  return scheme
}

export function getCustomerAuthConfig(): CustomerAuthConfig {
  const shopDomain = ensureValue(
    coalesceEnv(["EXPO_PUBLIC_SHOP_DOMAIN", "EXPO_PUBLIC_SHOPIFY_DOMAIN"]),
    "Missing EXPO_PUBLIC_SHOP_DOMAIN (or EXPO_PUBLIC_SHOPIFY_DOMAIN)"
  )

  const clientId = ensureValue(
    coalesceEnv([
      "EXPO_PUBLIC_CUSTOMER_APP_CLIENT_ID",
      "EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID",
    ]),
    "Missing EXPO_PUBLIC_CUSTOMER_APP_CLIENT_ID"
  )

  const shopId = ensureValue(
    coalesceEnv(["EXPO_PUBLIC_SHOP_ID", "EXPO_PUBLIC_SHOPIFY_SHOP_ID"]),
    "Missing EXPO_PUBLIC_SHOP_ID"
  )

  const redirectScheme = resolveRedirectScheme()
  // Always emit the custom scheme explicitly so Expo's dev proxy URLs are never used during auth.
  const redirectUri = `${redirectScheme}://callback`
  const scopes = coalesceEnv(["EXPO_PUBLIC_OAUTH_SCOPES"], DEFAULT_SCOPES) ?? DEFAULT_SCOPES

  const debugAuth = readEnv("EXPO_PUBLIC_DEBUG_AUTH") === "1" || readEnv("EXPO_PUBLIC_DEBUG_AUTH") === "true"

  const fallbackAuthEndpoints = {
    authorizationEndpoint: `https://shopify.com/authentication/${shopId}/oauth/authorize`,
    tokenEndpoint: `https://shopify.com/authentication/${shopId}/oauth/token`,
    logoutEndpoint: `https://shopify.com/authentication/${shopId}/logout`,
  }

  const overrides = {
    authorizationEndpoint: coalesceEnv([
      "EXPO_PUBLIC_SHOPIFY_AUTH_ENDPOINT",
      "EXPO_PUBLIC_SHOPIFY_OPENID_AUTHORIZATION_ENDPOINT",
    ]),
    tokenEndpoint: coalesceEnv([
      "EXPO_PUBLIC_SHOPIFY_TOKEN_ENDPOINT",
      "EXPO_PUBLIC_SHOPIFY_OPENID_TOKEN_ENDPOINT",
    ]),
    logoutEndpoint: coalesceEnv([
      "EXPO_PUBLIC_SHOPIFY_LOGOUT_ENDPOINT",
      "EXPO_PUBLIC_SHOPIFY_OPENID_LOGOUT_ENDPOINT",
    ]),
    openIdConfigurationUrl: coalesceEnv([
      "EXPO_PUBLIC_SHOPIFY_DISCOVERY_ISSUER",
      "EXPO_PUBLIC_OPENID_CONFIGURATION_URL",
    ]),
    customerApiEndpoint: coalesceEnv([
      "EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_ENDPOINT",
      "EXPO_PUBLIC_CUSTOMER_API_GRAPHQL_ENDPOINT",
    ]),
  }

  return {
    shopDomain,
    clientId,
    shopId,
    scopes,
    redirectUri,
    redirectScheme,
    debugAuth,
    userAgent: USER_AGENT,
    fallbackAuthEndpoints,
    overrides,
  }
}
