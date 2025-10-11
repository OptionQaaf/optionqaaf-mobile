// lib/shopify/env.ts

// Core shop / storefront
export const SHOPIFY_DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN as string // e.g. optionqaaf.com
export const SHOPIFY_API_VERSION = (process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION as string) || "2025-10"

// OAuth (public client)
export const SHOPIFY_SHOP_ID = process.env.EXPO_PUBLIC_SHOPIFY_SHOP_ID as string
export const SHOPIFY_CUSTOMER_CLIENT_ID = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID as string
export const SHOPIFY_CUSTOMER_REDIRECT_URI =
  (process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_REDIRECT_URI as string) || "shop.85072904499.app://callback"
export const SHOPIFY_SCOPES =
  (process.env.EXPO_PUBLIC_SHOPIFY_SCOPES as string) || "openid email customer-account-api:full"

// Optional endpoint overrides (you’ve set them in .env — we’ll prefer them)
export const SHOPIFY_OPENID_AUTHORIZATION_ENDPOINT = process.env.EXPO_PUBLIC_SHOPIFY_OPENID_AUTHORIZATION_ENDPOINT || ""
export const SHOPIFY_OPENID_TOKEN_ENDPOINT = process.env.EXPO_PUBLIC_SHOPIFY_OPENID_TOKEN_ENDPOINT || ""
export const SHOPIFY_OPENID_LOGOUT_ENDPOINT = process.env.EXPO_PUBLIC_SHOPIFY_OPENID_LOGOUT_ENDPOINT || ""

// Optional graph override (only if discovery ever fails)
export const GRAPHQL_OVERRIDE = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_ENDPOINT || ""

// Helpful headers Shopify sometimes enforces
export const ORIGIN_HEADER = `https://${SHOPIFY_DOMAIN}`
export const USER_AGENT = "OptionQaaf-Mobile/1.0 (+expo-sdk-54)"

// Guards
if (!SHOPIFY_DOMAIN) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_DOMAIN")
if (!SHOPIFY_SHOP_ID) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_SHOP_ID")
if (!SHOPIFY_CUSTOMER_CLIENT_ID) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID")
