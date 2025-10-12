import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { gql } from "graphql-tag"
import {
  CollectionByHandleDocument,
  type CollectionByHandleQuery,
  ProductByHandleDocument,
  type ProductByHandleQuery,
  SearchProductsDocument,
  type SearchProductsQuery,
} from "@/lib/shopify/gql/graphql"

export async function getProductByHandle(handle: string, locale?: { country?: string; language?: string }) {
  return callShopify<ProductByHandleQuery>(() =>
    shopifyClient.request(ProductByHandleDocument, {
      handle,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )
}

export async function getCollectionProducts(
  args: { handle: string; pageSize?: number; after?: string | null },
  locale?: { country?: string; language?: string },
) {
  return callShopify<CollectionByHandleQuery>(() =>
    shopifyClient.request(CollectionByHandleDocument, {
      handle: args.handle,
      pageSize: args.pageSize ?? 24,
      after: args.after ?? null,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )
}

export async function searchProducts(
  args: { query: string; pageSize?: number; after?: string | null },
  locale?: { country?: string; language?: string },
) {
  return callShopify<SearchProductsQuery>(() =>
    shopifyClient.request(SearchProductsDocument, {
      query: args.query,
      pageSize: args.pageSize ?? 24,
      after: args.after ?? null,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )
}

const PRODUCT_HANDLE_BY_ID_DOCUMENT = gql`
  query ProductHandleById($id: ID!) {
    product(id: $id) {
      handle
    }
  }
`

type ProductHandleByIdQuery = {
  product?: { handle?: string | null } | null
}

export async function getProductHandleById(id: string): Promise<string | null> {
  const data = await callShopify<ProductHandleByIdQuery>(() =>
    shopifyClient.request(PRODUCT_HANDLE_BY_ID_DOCUMENT, { id }),
  )
  return data.product?.handle ?? null
}
