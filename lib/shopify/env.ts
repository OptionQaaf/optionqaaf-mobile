import * as Linking from "expo-linking"

export const SHOPIFY_DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN as string
export const SHOPIFY_API_VERSION = (process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION || "2025-07") as string
export const SHOPIFY_SHOP_ID = process.env.EXPO_PUBLIC_SHOPIFY_SHOP_ID as string
export const SHOPIFY_CUSTOMER_CLIENT_ID = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID as string
export const SHOPIFY_CUSTOMER_REDIRECT_URI =
  (process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_REDIRECT_URI as string) || Linking.createURL("callback")

if (!SHOPIFY_DOMAIN) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_DOMAIN")
if (!SHOPIFY_SHOP_ID) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_SHOP_ID")
if (!SHOPIFY_CUSTOMER_CLIENT_ID) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID")

export type LocalePrefs = {
  country?: string
  language?: string
  currency?: string
}
