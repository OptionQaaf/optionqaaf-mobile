export const SHOPIFY_DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN as string
export const SHOPIFY_API_VERSION = (process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION || "2025-07") as string
export const SHOPIFY_CUSTOMER_CLIENT_ID = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID
export const SHOPIFY_CUSTOMER_SCOPES =
  process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_SCOPES || "openid email customer-account-api:full"

if (!SHOPIFY_DOMAIN) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_DOMAIN")

export type LocalePrefs = {
  country?: string
  language?: string
  currency?: string
}
