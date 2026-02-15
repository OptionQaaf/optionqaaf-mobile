import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { addFypDebugProductPayload, fypLogOnce, summarizeProductPayload } from "@/features/debug/fypDebug"
import type { ProductRecommendationIntent } from "@/lib/shopify/gql/graphql"
import { gql } from "graphql-tag"

const PRODUCT_RECOMMENDATION_FIELDS = `
  id
  handle
  title
  vendor
  productType
  tags
  createdAt
  availableForSale
  featuredImage {
    id
    url(transform: { preferredContentType: WEBP })
    altText
    width
    height
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
    maxVariantPrice {
      amount
      currencyCode
    }
  }
  compareAtPriceRange {
    minVariantPrice {
      amount
      currencyCode
    }
    maxVariantPrice {
      amount
      currencyCode
    }
  }
`

const PRODUCT_RECOMMENDATIONS_BY_ID_DOCUMENT = gql`
  query ProductRecommendationsById(
    $productId: ID!
    $intent: ProductRecommendationIntent
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    productRecommendations(productId: $productId, intent: $intent) {
      ${PRODUCT_RECOMMENDATION_FIELDS}
    }
  }
`

const PRODUCT_RECOMMENDATIONS_BY_HANDLE_DOCUMENT = gql`
  query ProductRecommendationsByHandle(
    $productHandle: String!
    $intent: ProductRecommendationIntent
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    productRecommendations(productHandle: $productHandle, intent: $intent) {
      ${PRODUCT_RECOMMENDATION_FIELDS}
    }
  }
`

export type RecommendedProductItem = {
  id: string
  handle: string
  title: string
  vendor: string
  productType: string
  tags: string[]
  createdAt: string
  availableForSale: boolean
  featuredImage?: {
    id?: string | null
    url?: string | null
    altText?: string | null
    width?: number | null
    height?: number | null
  } | null
  priceRange?: {
    minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null
    maxVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null
  } | null
  compareAtPriceRange?: {
    minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null
    maxVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null
  } | null
}

type ProductRecommendationsQueryResult = {
  productRecommendations?: RecommendedProductItem[] | null
}

export async function getRecommendedProducts(
  input: {
    productId?: string | null
    productHandle?: string | null
    intent?: ProductRecommendationIntent
  },
  locale?: { country?: string; language?: string },
) {
  const normalizedProductId = typeof input.productId === "string" && input.productId.trim() ? input.productId : null
  const normalizedProductHandle =
    typeof input.productHandle === "string" && input.productHandle.trim() ? input.productHandle : null
  if (!normalizedProductId && !normalizedProductHandle) {
    return { productRecommendations: [] }
  }
  if (normalizedProductId) {
    const response = await callShopify<ProductRecommendationsQueryResult>(() =>
      shopifyClient.request(PRODUCT_RECOMMENDATIONS_BY_ID_DOCUMENT, {
        productId: normalizedProductId,
        intent: input.intent ?? "RELATED",
        country: locale?.country as any,
        language: locale?.language as any,
      }),
    )
    fypLogOnce(`SHOPIFY_PRODUCTS_SUMMARY:recommendations:id:${normalizedProductId}`, "SHOPIFY_PRODUCTS_SUMMARY", {
      source: "productRecommendationsById",
      ...summarizeProductPayload((response.productRecommendations ?? []) as any[]),
    })
    const first = (response.productRecommendations ?? [])[0] as any
    if (first?.handle) addFypDebugProductPayload("recommendationsById", String(first.handle), first)
    return response
  }

  const response = await callShopify<ProductRecommendationsQueryResult>(() =>
    shopifyClient.request(PRODUCT_RECOMMENDATIONS_BY_HANDLE_DOCUMENT, {
      productHandle: normalizedProductHandle!,
      intent: input.intent ?? "RELATED",
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )
  fypLogOnce(`SHOPIFY_PRODUCTS_SUMMARY:recommendations:handle:${normalizedProductHandle}`, "SHOPIFY_PRODUCTS_SUMMARY", {
    source: "productRecommendationsByHandle",
    ...summarizeProductPayload((response.productRecommendations ?? []) as any[]),
  })
  const first = (response.productRecommendations ?? [])[0] as any
  if (first?.handle) addFypDebugProductPayload("recommendationsByHandle", String(first.handle), first)
  return response
}
