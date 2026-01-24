import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { gql } from "graphql-tag"
import {
  CollectionByHandleDocument,
  type CollectionByHandleQuery,
  type ProductCollectionSortKeys,
  ProductByHandleDocument,
  type ProductByHandleQuery,
  type ProductSortKeys,
  type ProductVariant,
  type SearchProductsQuery,
} from "@/lib/shopify/gql/graphql"

const SEARCH_PRODUCTS_WITH_SORT_DOCUMENT = gql`
  query SearchProducts(
    $query: String!
    $pageSize: Int!
    $after: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: $pageSize, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        handle
        title
        vendor
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
      }
    }
  }
`

const COLLECTION_PRODUCTS_WITH_IMAGES_DOCUMENT = gql`
  query CollectionByHandleWithImages(
    $handle: String!
    $pageSize: Int!
    $after: String
    $country: CountryCode
    $language: LanguageCode
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      title
      image {
        id
        url(transform: { preferredContentType: WEBP })
        altText
        width
        height
      }
      products(first: $pageSize, after: $after, sortKey: $sortKey, reverse: $reverse) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          handle
          title
          vendor
          availableForSale
          featuredImage {
            id
            url(transform: { preferredContentType: WEBP })
            altText
            width
            height
          }
          images(first: 6) {
            nodes {
              id
              url(transform: { preferredContentType: WEBP })
              altText
              width
              height
            }
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
        }
      }
    }
  }
`

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
  args: {
    handle: string
    pageSize?: number
    after?: string | null
    sortKey?: ProductCollectionSortKeys | null
    reverse?: boolean
  },
  locale?: { country?: string; language?: string },
) {
  return callShopify<CollectionByHandleQuery>(() =>
    shopifyClient.request(CollectionByHandleDocument, {
      handle: args.handle,
      pageSize: args.pageSize ?? 24,
      after: args.after ?? null,
      sortKey: args.sortKey ?? null,
      reverse: args.reverse ?? null,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )
}

export async function getCollectionProductsWithImages(
  args: {
    handle: string
    pageSize?: number
    after?: string | null
    sortKey?: ProductCollectionSortKeys | null
    reverse?: boolean
  },
  locale?: { country?: string; language?: string },
) {
  return callShopify<any>(() =>
    shopifyClient.request(COLLECTION_PRODUCTS_WITH_IMAGES_DOCUMENT, {
      handle: args.handle,
      pageSize: args.pageSize ?? 24,
      after: args.after ?? null,
      sortKey: args.sortKey ?? null,
      reverse: args.reverse ?? null,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )
}

export async function searchProducts(
  args: { query: string; pageSize?: number; after?: string | null; sortKey?: ProductSortKeys | null; reverse?: boolean },
  locale?: { country?: string; language?: string },
) {
  const trimmed = args.query.trim()
  const isNumericId = /^\d+$/.test(trimmed)

  async function productFromHandle(pHandle: string) {
    const prod = await getProductByHandle(pHandle, locale)
    const p = prod.product
    if (!p) return null
    const variants = (p.variants?.nodes ?? []) as ProductVariant[]
    let minPrice = Number.POSITIVE_INFINITY
    let minCompare = Number.POSITIVE_INFINITY
    let currency = "USD"
    let available = false
    for (const v of variants) {
      if (!v) continue
      const amt = Number((v as any)?.price?.amount ?? 0)
      const cmp = Number((v as any)?.compareAtPrice?.amount ?? Number.POSITIVE_INFINITY)
      if (Number.isFinite(amt) && amt < minPrice) minPrice = amt
      if (Number.isFinite(cmp) && cmp < minCompare) minCompare = cmp
      if ((v as any)?.price?.currencyCode) currency = String((v as any).price.currencyCode)
      if (v.availableForSale !== false) available = true
    }
    if (!Number.isFinite(minPrice)) minPrice = 0
    const compareAt = Number.isFinite(minCompare) ? minCompare : undefined

    return {
      id: p.id,
      handle: p.handle,
      title: p.title,
      vendor: (p as any)?.vendor ?? "",
      availableForSale: available,
      featuredImage: p.featuredImage as any,
      priceRange: {
        minVariantPrice: { amount: String(minPrice), currencyCode: currency as any },
        maxVariantPrice: { amount: String(minPrice), currencyCode: currency as any },
      },
      compareAtPriceRange: {
        minVariantPrice: {
          amount: String(compareAt ?? minPrice),
          currencyCode: currency as any,
        },
        maxVariantPrice: {
          amount: String(compareAt ?? minPrice),
          currencyCode: currency as any,
        },
      },
      variants,
    }
  }

  async function searchProductByVariantCode(code: string) {
    const normalized = code.trim()
    const quoted = JSON.stringify(normalized)
    const condensed = normalized.replace(/\s+/g, "")
    const queries = [
      `sku:${quoted} OR barcode:${quoted}`,
      condensed !== normalized ? `sku:${condensed} OR barcode:${condensed}` : null,
    ].filter(Boolean) as string[]

    for (const q of queries) {
      try {
        const res = await callShopify<SearchProductsQuery>(() =>
          shopifyClient.request(SEARCH_PRODUCTS_WITH_SORT_DOCUMENT, {
            query: q,
            pageSize: 3,
            after: null,
            sortKey: args.sortKey ?? null,
            reverse: args.reverse ?? null,
            country: locale?.country as any,
            language: locale?.language as any,
          }),
        )
        const nodes = res.products?.nodes ?? []
        if (!nodes.length) continue
        for (const n of nodes) {
          const handle = (n as any)?.handle
          if (!handle) continue
          const full = await productFromHandle(handle)
          if (!full) continue
          const match = (full.variants ?? []).find((v) => {
            const bc = (v as any)?.barcode
            return bc === normalized || bc === condensed
          })
          const barcode = (match as any)?.barcode
          if (match && barcode) {
            const node: any = {
              ...full,
              availableForSale: full.availableForSale ?? match.availableForSale ?? true,
              __variantId: match.id,
              __variantCode: barcode,
            }
            delete node.variants
            return node
          }
        }
      } catch (err) {
        // ignore and continue searching other queries
      }
    }
    return null
  }

  // Fallback: if someone searches a numeric product ID, try to resolve it directly.
  if (isNumericId && !args.after) {
    const gid = `gid://shopify/Product/${trimmed}`
    const handle = await getProductHandleById(gid)
    if (handle) {
      const node = await productFromHandle(handle)
      if (node) {
        delete (node as any).variants
        return {
          products: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [node],
          },
        } as unknown as SearchProductsQuery
      }
    }

    // If product ID lookup failed, try barcode/sku variant lookup for numeric codes.
    const codeHit = await searchProductByVariantCode(trimmed)
    if (codeHit) {
      return {
        products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [codeHit] },
      } as unknown as SearchProductsQuery
    }
  }

  // If not numeric ID, still try barcode/sku variant lookup before general search.
  if (!args.after && trimmed && !isNumericId) {
    const codeHit = await searchProductByVariantCode(trimmed)
    if (codeHit) {
      return {
        products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [codeHit] },
      } as unknown as SearchProductsQuery
    }
  }

  return callShopify<SearchProductsQuery>(() =>
    shopifyClient.request(SEARCH_PRODUCTS_WITH_SORT_DOCUMENT, {
      query: args.query,
      pageSize: args.pageSize ?? 24,
      after: args.after ?? null,
      sortKey: args.sortKey ?? null,
      reverse: args.reverse ?? null,
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
