import { callShopify, shopifyClient } from "@/lib/shopify/client"
import {
  CollectionByHandleDocument,
  ProductByHandleDocument,
  type CollectionByHandleQuery,
  type ProductByHandleQuery,
  type ProductCollectionSortKeys,
  type ProductSortKeys,
  type ProductVariant,
  type SearchProductsQuery,
} from "@/lib/shopify/gql/graphql"
import { gql } from "graphql-tag"

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
        productType
        tags
        createdAt
        availableForSale
        metafield(namespace: "ai_data", key: "embedding_v1") {
          value
        }
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

const PRODUCTS_BY_HANDLES_DOCUMENT = gql`
  query ProductsByHandles($query: String!, $pageSize: Int!, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    products(first: $pageSize, query: $query, sortKey: RELEVANCE, reverse: false) {
      nodes {
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
      }
    }
  }
`

const NEWEST_PRODUCTS_DOCUMENT = gql`
  query NewestProducts(
    $pageSize: Int!
    $after: String
    $query: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: $pageSize, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
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
      }
    }
  }
`

const PRODUCT_EMBEDDING_BY_HANDLE_DOCUMENT = gql`
  query ProductEmbeddingByHandle($handle: String!, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      metafield(namespace: "ai_data", key: "embedding_v1") {
        value
      }
    }
  }
`

type ProductEmbeddingByHandleQuery = {
  product?: {
    id?: string | null
    metafield?: {
      value?: string | null
    } | null
  } | null
}

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
          metafield(namespace: "ai_data", key: "embedding_v1") {
            value
          }
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

export async function getProductByHandle(
  handle: string,
  locale?: { country?: string; language?: string },
  options?: { includeEmbedding?: boolean },
) {
  const productResponse = await callShopify<ProductByHandleQuery>(() =>
    shopifyClient.request(ProductByHandleDocument, {
      handle,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )

  if (!options?.includeEmbedding || !productResponse.product) {
    return productResponse
  }

  const embeddingResponse = await callShopify<ProductEmbeddingByHandleQuery>(() =>
    shopifyClient.request(PRODUCT_EMBEDDING_BY_HANDLE_DOCUMENT, {
      handle,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  ).catch(() => null)

  return {
    ...productResponse,
    product: {
      ...productResponse.product,
      metafield: embeddingResponse?.product?.metafield ?? null,
    },
  }
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
  args: {
    query: string
    pageSize?: number
    after?: string | null
    sortKey?: ProductSortKeys | null
    reverse?: boolean
  },
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
      metafield: (p as any)?.metafield ?? null,
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
      } catch {
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

  const response = await callShopify<SearchProductsQuery>(() =>
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

  return response
}

export type ProductSearchCandidate = {
  id: string
  handle: string
  title?: string | null
  vendor?: string | null
  productType?: string | null
  tags?: string[] | null
  createdAt?: string | null
  availableForSale?: boolean | null
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
  metafield?: {
    value?: string | null
  } | null
}

function normalizeHandle(input?: string | null): string {
  if (typeof input !== "string") return ""
  return input.trim().toLowerCase()
}

function mapProductDetailToCandidate(product: any): ProductSearchCandidate | null {
  const handle = normalizeHandle(product?.handle)
  const id = typeof product?.id === "string" ? product.id : ""
  if (!handle || !id) return null

  const variants: any[] = Array.isArray(product?.variants?.nodes) ? product.variants.nodes : []
  let minPrice = Number.POSITIVE_INFINITY
  let minCompareAt = Number.POSITIVE_INFINITY
  let currencyCode = "USD"
  let availableForSale = false

  for (const variant of variants) {
    if (!variant) continue
    const amount = Number(variant?.price?.amount ?? Number.NaN)
    const compareAmount = Number(variant?.compareAtPrice?.amount ?? Number.NaN)
    if (Number.isFinite(amount) && amount < minPrice) minPrice = amount
    if (Number.isFinite(compareAmount) && compareAmount < minCompareAt) minCompareAt = compareAmount
    if (typeof variant?.price?.currencyCode === "string" && variant.price.currencyCode) {
      currencyCode = variant.price.currencyCode
    }
    if (variant?.availableForSale !== false) {
      availableForSale = true
    }
  }

  if (!Number.isFinite(minPrice)) minPrice = 0
  const compareAt = Number.isFinite(minCompareAt) ? minCompareAt : minPrice

  return {
    id,
    handle,
    title: typeof product?.title === "string" ? product.title : null,
    vendor: typeof product?.vendor === "string" ? product.vendor : null,
    productType: null,
    tags: null,
    createdAt: null,
    availableForSale,
    featuredImage: product?.featuredImage ?? null,
    priceRange: {
      minVariantPrice: { amount: String(minPrice), currencyCode },
      maxVariantPrice: { amount: String(minPrice), currencyCode },
    },
    compareAtPriceRange: {
      minVariantPrice: { amount: String(compareAt), currencyCode },
      maxVariantPrice: { amount: String(compareAt), currencyCode },
    },
    metafield: product?.metafield ?? null,
  }
}

export async function getProductsByHandles(
  handles: string[],
  locale?: { country?: string; language?: string },
  options?: { chunkSize?: number },
): Promise<ProductSearchCandidate[]> {
  const requested = Array.from(new Set(handles.map((entry) => normalizeHandle(entry)).filter(Boolean)))
  if (!requested.length) return []

  const chunkSize = Math.max(10, Math.min(30, options?.chunkSize ?? 25))
  const chunks: string[][] = []
  for (let i = 0; i < requested.length; i += chunkSize) {
    chunks.push(requested.slice(i, i + chunkSize))
  }

  const byHandle = new Map<string, ProductSearchCandidate>()

  await Promise.all(
    chunks.map(async (chunk) => {
      const query = chunk.map((handle) => `handle:${JSON.stringify(handle)}`).join(" OR ")
      const response = await callShopify<SearchProductsQuery>(() =>
        shopifyClient.request(PRODUCTS_BY_HANDLES_DOCUMENT, {
          query,
          pageSize: chunk.length,
          country: locale?.country as any,
          language: locale?.language as any,
        }),
      ).catch(() => null)

      const nodes = (response?.products?.nodes ?? []).filter(Boolean)
      for (const node of nodes as any[]) {
        const handle = normalizeHandle(node?.handle)
        if (!handle || byHandle.has(handle)) continue
        byHandle.set(handle, {
          id: String(node?.id ?? ""),
          handle: String(node?.handle ?? ""),
          title: typeof node?.title === "string" ? node.title : null,
          vendor: typeof node?.vendor === "string" ? node.vendor : null,
          productType: typeof node?.productType === "string" ? node.productType : null,
          tags: Array.isArray(node?.tags) ? node.tags : null,
          createdAt: typeof node?.createdAt === "string" ? node.createdAt : null,
          availableForSale: typeof node?.availableForSale === "boolean" ? node.availableForSale : null,
          featuredImage: node?.featuredImage ?? null,
          priceRange: node?.priceRange ?? null,
          compareAtPriceRange: node?.compareAtPriceRange ?? null,
          metafield: null,
        })
      }
    }),
  )

  const missingHandles = requested.filter((handle) => !byHandle.has(handle))
  if (missingHandles.length) {
    const fallbackChunkSize = 8
    for (let i = 0; i < missingHandles.length; i += fallbackChunkSize) {
      const chunk = missingHandles.slice(i, i + fallbackChunkSize)
      const results = await Promise.all(
        chunk.map(async (handle) => {
          const response = await getProductByHandle(handle, locale).catch(() => null)
          return mapProductDetailToCandidate((response as any)?.product)
        }),
      )
      for (const candidate of results) {
        if (!candidate) continue
        const key = normalizeHandle(candidate.handle)
        if (!key || byHandle.has(key)) continue
        byHandle.set(key, candidate)
      }
    }
  }

  return requested.map((handle) => byHandle.get(handle)).filter((item): item is ProductSearchCandidate => Boolean(item))
}

type NewestProductsQuery = {
  products?: {
    pageInfo?: {
      hasNextPage?: boolean | null
      endCursor?: string | null
    } | null
    nodes?: Array<ProductSearchCandidate | null> | null
  } | null
}

export async function getNewestProductsPage(
  args: {
    pageSize?: number
    after?: string | null
    query?: string | null
  },
  locale?: { country?: string; language?: string },
): Promise<{ items: ProductSearchCandidate[]; cursor: string | null; hasNext: boolean }> {
  const pageSize = Math.max(8, Math.min(80, args.pageSize ?? 40))
  const response = await callShopify<NewestProductsQuery>(() =>
    shopifyClient.request(NEWEST_PRODUCTS_DOCUMENT, {
      pageSize,
      after: args.after ?? null,
      query: args.query?.trim() ? args.query.trim() : null,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )
  const page = response.products
  const items = (page?.nodes ?? []).filter(Boolean).map((node) => ({
    id: String(node?.id ?? ""),
    handle: String(node?.handle ?? ""),
    title: typeof node?.title === "string" ? node.title : null,
    vendor: typeof node?.vendor === "string" ? node.vendor : null,
    productType: typeof node?.productType === "string" ? node.productType : null,
    tags: Array.isArray(node?.tags) ? node.tags : null,
    createdAt: typeof node?.createdAt === "string" ? node.createdAt : null,
    availableForSale: typeof node?.availableForSale === "boolean" ? node.availableForSale : null,
    featuredImage: node?.featuredImage ?? null,
    priceRange: node?.priceRange ?? null,
    compareAtPriceRange: node?.compareAtPriceRange ?? null,
    metafield: null,
  }))
  return {
    items: items.filter((entry) => Boolean(entry.id && entry.handle)),
    cursor: page?.pageInfo?.endCursor ?? null,
    hasNext: Boolean(page?.pageInfo?.hasNextPage),
  }
}

function normalizeSearchTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, " ")
    .replace(/\s+/g, " ")
}

function sanitizeFieldValue(value: string): string {
  return value.replace(/"/g, '\\"').trim()
}

export async function searchProductsByTerms(
  args: {
    terms: string[]
    gender?: "male" | "female" | "unknown"
    productType?: string | null
    vendor?: string | null
    first?: number
    after?: string | null
  },
  locale?: { country?: string; language?: string },
): Promise<{ items: ProductSearchCandidate[]; cursor: string | null; hasNext: boolean; query: string }> {
  const first = Math.max(8, Math.min(40, args.first ?? 24))
  const terms = Array.from(new Set(args.terms.map(normalizeSearchTerm).filter((entry) => entry.length >= 3))).slice(
    0,
    8,
  )

  const clauses: string[] = []
  if (args.productType && normalizeSearchTerm(args.productType)) {
    clauses.push(`product_type:${JSON.stringify(sanitizeFieldValue(args.productType))}`)
  }
  if (args.vendor && normalizeSearchTerm(args.vendor)) {
    clauses.push(`vendor:${JSON.stringify(sanitizeFieldValue(args.vendor))}`)
  }

  for (const term of terms) {
    clauses.push(JSON.stringify(sanitizeFieldValue(term)))
  }
  if (args.gender === "male") clauses.push("tag:men")
  if (args.gender === "female") clauses.push("tag:women")

  const query = clauses.join(" ")
  if (!query) return { items: [], cursor: null, hasNext: false, query: "" }

  const res = await searchProducts(
    {
      query,
      pageSize: first,
      after: args.after ?? null,
      sortKey: "RELEVANCE",
      reverse: false,
    },
    locale,
  )

  const nodes = (res.products?.nodes ?? []).filter(Boolean)
  const items: ProductSearchCandidate[] = nodes.map((node: any) => ({
    id: String(node?.id ?? ""),
    handle: String(node?.handle ?? ""),
    title: typeof node?.title === "string" ? node.title : null,
    vendor: typeof node?.vendor === "string" ? node.vendor : null,
    productType: typeof node?.productType === "string" ? node.productType : null,
    tags: Array.isArray(node?.tags) ? node.tags : null,
    createdAt: typeof node?.createdAt === "string" ? node.createdAt : null,
    availableForSale: typeof node?.availableForSale === "boolean" ? node.availableForSale : null,
    featuredImage: node?.featuredImage ?? null,
    priceRange: node?.priceRange ?? null,
    compareAtPriceRange: node?.compareAtPriceRange ?? null,
    metafield: node?.metafield ?? null,
  }))
  const pageInfo = res.products?.pageInfo

  return {
    items: items.filter((entry) => Boolean(entry.id && entry.handle)),
    cursor: pageInfo?.endCursor ?? null,
    hasNext: Boolean(pageInfo?.hasNextPage),
    query,
  }
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
