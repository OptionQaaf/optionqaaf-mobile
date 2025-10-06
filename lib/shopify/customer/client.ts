import { GraphQLClient } from "graphql-request"

import { getCustomerApiEndpoint } from "@/lib/shopify/customer/discovery"
import { SHOPIFY_DOMAIN, SHOPIFY_SHOP_ID } from "@/lib/shopify/env"

export class CustomerApiError extends Error {
  constructor(message: string, public status?: number, public cause?: unknown) {
    super(message)
    this.name = "CustomerApiError"
  }
}

let memoizedEndpoint: string | null = null
let memoizedShopDomain: string | null = null
let loggedGraphEndpoint = false

export async function createCustomerGqlClient(accessToken: string, shopDomain: string) {
  if (!memoizedEndpoint || memoizedShopDomain !== shopDomain) {
    memoizedEndpoint = await getCustomerApiEndpoint()
    memoizedShopDomain = shopDomain
  }
  if (typeof __DEV__ !== "undefined" && __DEV__ && !loggedGraphEndpoint) {
    console.log("[CustomerAuth] GraphQL endpoint:", memoizedEndpoint)
    loggedGraphEndpoint = true
  }
  const originDomain = SHOPIFY_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const client = new GraphQLClient(memoizedEndpoint!, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Shopify-Shop-Id": SHOPIFY_SHOP_ID,
      Origin: `https://${originDomain}`,
      "User-Agent": "OptionQaafMobile/1.0 (ReactNative)",
      ...(typeof __DEV__ !== "undefined" && __DEV__ ? { "Shopify-GraphQL-Cost-Debug": "1" } : {}),
    },
  })
  return client
}

let inflight: Promise<unknown> | null = null

async function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const prev = inflight
  const current = (async () => {
    try {
      if (prev) {
        await prev.catch(() => {})
      }
      return await task()
    } finally {
      if (inflight === current) inflight = null
    }
  })()
  inflight = current
  return current
}

type GraphQLErrorShape = { message?: string; extensions?: { code?: string }; [key: string]: any }

function isThrottleResponse(error: any): { throttled: boolean; retryAfter?: number } {
  const status = error?.response?.status
  if (status === 429) {
    const retryHeader = error?.response?.headers?.get?.("retry-after")
    const retryAfter = retryHeader ? Number(retryHeader) * 1000 : undefined
    return { throttled: true, retryAfter }
  }
  if (status === 200 || status === undefined) {
    const errors: GraphQLErrorShape[] | undefined = error?.response?.errors
    if (Array.isArray(errors)) {
      const throttled = errors.some((e) =>
        typeof e?.message === "string" && e.message.toLowerCase().includes("throttled"),
      )
      const throttledCode = errors.some((e) => e?.extensions?.code === "THROTTLED")
      if (throttled || throttledCode) {
        return { throttled: true }
      }
    }
  }
  return { throttled: false }
}

function logCostExtensions(extensions: any) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return
  if (extensions?.cost) {
    console.log("[CustomerAPI] cost", extensions.cost)
  }
}

type RawResult<T> = { data: T; extensions?: any }

export async function callCustomerApi<T>(fn: () => Promise<RawResult<T>>): Promise<T> {
  const start = Date.now()
  const attempt = async (): Promise<T> => {
    try {
      const result = await fn()
      logCostExtensions(result?.extensions)
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.log(`[ShopifyCustomer] ${Date.now() - start}ms`)
      }
      return result.data
    } catch (error: any) {
      const { throttled, retryAfter } = isThrottleResponse(error)
      if (throttled) throw { throttled: true, error, retryAfter }
      const duration = Date.now() - start
      const status = error?.response?.status ?? error?.status
      const details = error?.response?.errors?.map((e: any) => e.message).join("; ") || error?.message
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(
          `[ShopifyCustomer] failed in ${duration}ms${status ? ` (${status})` : ""}: ${details || "Customer API request failed"}`,
        )
        if (status === 404) {
          const res = error?.response
          const headers: Record<string, string> = {}
          if (res?.headers?.forEach) {
            res.headers.forEach((value: string, key: string) => {
              headers[key] = value
            })
          }
          console.warn("[CustomerAPI] 404 url", res?.url ?? "unknown")
          console.warn("[CustomerAPI] 404 headers", headers)
          const body = res?.data ?? error?.response?.body ?? error?.response?.error ?? null
          if (body) console.warn("[CustomerAPI] 404 body", body)
        }
      }
      throw new CustomerApiError(details || "Customer API request failed", status, error)
    }
  }

  const maxRetries = 3
  let delay = 800
  for (let attemptIndex = 0; attemptIndex < maxRetries; attemptIndex += 1) {
    try {
      return await enqueue(attempt)
    } catch (err: any) {
      if (err?.throttled) {
        const jitter = Math.random() * 200
        const wait = err.retryAfter ?? delay + jitter
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn(`[CustomerAPI] throttled – retrying after ${Math.round(wait)}ms`)
        }
        await new Promise((resolve) => setTimeout(resolve, wait))
        delay *= 2
        if (attemptIndex === maxRetries - 1) {
          throw new CustomerApiError("Customer API throttled", 429, err.error)
        }
        continue
      }
      throw err
    }
  }
  throw new CustomerApiError("Customer API throttled", 429)
}
