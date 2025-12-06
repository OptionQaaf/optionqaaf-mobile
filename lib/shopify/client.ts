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
export async function callShopify<T>(
  fn: () => Promise<T>,
  options: { retries?: number; retryDelayMs?: number } = {},
): Promise<T> {
  const maxRetries = options.retries ?? 3
  const baseDelay = options.retryDelayMs ?? 150

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now()
    try {
      const res = await fn()
      const dur = Date.now() - start
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.log(`[Shopify] ${dur}ms`)
      }
      return res
    } catch (err: any) {
      const dur = Date.now() - start
      const details = err?.response?.errors?.map((e: any) => e.message).join("; ") || err?.message
      const isConflict = typeof details === "string" && details.toLowerCase().includes("conflicted with another request")
      const canRetry = isConflict && attempt < maxRetries

      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(`[Shopify] failed in ${dur}ms: ${details || "Unknown error"}${canRetry ? " (retrying)" : ""}`)
      }

      if (!canRetry) {
        throw new ShopifyError(details || "Shopify request failed", err)
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * baseDelay
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  // Should never reach here
  throw new ShopifyError("Shopify request failed after retries")
}
