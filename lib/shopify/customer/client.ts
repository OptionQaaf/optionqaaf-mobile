import { getValidAccessToken } from "@/lib/shopify/customer/auth"
import { getCustomerGraphqlEndpoint } from "@/lib/shopify/customer/discovery"
import { ORIGIN_HEADER, USER_AGENT } from "@/lib/shopify/env"
import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import { print } from "graphql"

type GQLError = { message: string; extensions?: any }
type GQ<T> = { data?: T; errors?: GQLError[] }

type QueryInput<T, V> = string | DocumentNode<T, V>

export async function customerGraphQL<TData, TVariables = Record<string, any>>(
  query: QueryInput<TData, TVariables>,
  variables?: TVariables,
): Promise<TData> {
  const url = await getCustomerGraphqlEndpoint()
  const token = await getValidAccessToken()
  if (!token) throw new Error("Not authenticated")

  const textQuery = typeof query === "string" ? query : print(query)

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      Origin: ORIGIN_HEADER,
      "User-Agent": USER_AGENT,
      // Optional if your edge wants it:
      // 'Shopify-Shop-Id': '85072904499',
    },
    body: JSON.stringify({ query: textQuery, variables }),
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
