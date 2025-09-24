export const SHOPIFY_DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN as string
export const SHOPIFY_STOREFRONT_TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN as string
export const SHOPIFY_API_VERSION = (process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION || "2025-07") as string
export const SHOPIFY_CUSTOMER_CLIENT_ID = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID
export const SHOPIFY_CUSTOMER_SCOPES = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_SCOPES || "openid email profile"
export const SHOPIFY_CUSTOMER_REDIRECT_URL = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_REDIRECT_URL!

// optional if you want to extract the scheme for reuse
export const SHOPIFY_CUSTOMER_REDIRECT_SCHEME =
  process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_REDIRECT_SCHEME || "shop.85072904499.app"

if (!SHOPIFY_DOMAIN) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_DOMAIN")
if (!SHOPIFY_STOREFRONT_TOKEN) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN")

export type LocalePrefs = {
  country?: string
  language?: string
  currency?: string
}
