import { getValidAccessToken } from "@/lib/shopify/customer/auth"
import { getCustomerGraphqlEndpoint } from "@/lib/shopify/customer/discovery"
import { ORIGIN_HEADER, USER_AGENT } from "@/lib/shopify/env"

type GQLError = { message: string; extensions?: any }
type GQ<T> = { data?: T; errors?: GQLError[] }

export async function customerGraphQL<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const url = await getCustomerGraphqlEndpoint()
  const token = await getValidAccessToken()
  if (!token) throw new Error("Not authenticated")

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      Origin: ORIGIN_HEADER,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ query, variables }),
  })

  const text = await res.text()
  let json: GQ<T> | null = null
  try {
    json = JSON.parse(text)
  } catch {
    /* leave json null for better error */
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
  if (!json?.data && json?.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "))
  if (!json?.data) throw new Error("No data")
  return json.data
}
