import { GraphQLClient } from "graphql-request"

const DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN!
const TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN!
const API = process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION || "2024-10"

export const shopifyClient = new GraphQLClient(`https://${DOMAIN}/api/${API}/graphql.json`, {
  headers: { "X-Shopify-Storefront-Access-Token": TOKEN, "Content-Type": "application/json" },
})

export class ShopifyError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message)
    this.name = "ShopifyError"
  }
}
export async function callShopify<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    const details = err?.response?.errors?.map((e: any) => e.message).join("; ")
    throw new ShopifyError(details || err?.message || "Shopify request failed", err)
  }
}
