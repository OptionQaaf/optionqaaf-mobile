import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { RecommendedProductsDocument, type RecommendedProductsQuery } from "@/lib/shopify/gql/graphql"

export async function getRecommendedProducts(productId: string, locale?: { country?: string; language?: string }) {
  return callShopify<RecommendedProductsQuery>(() =>
    shopifyClient.request(RecommendedProductsDocument, {
      productId,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )
}
