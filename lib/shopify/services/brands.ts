import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { gql } from "graphql-tag"

type ProductVendorIndexQuery = {
  products?: {
    edges?: Array<{ node?: { vendor?: string | null } | null } | null> | null
    pageInfo?: { hasNextPage?: boolean | null; endCursor?: string | null } | null
  } | null
}

const PRODUCT_VENDOR_INDEX_DOCUMENT = gql`
  query ProductVendorIndex($pageSize: Int!, $cursor: String, $language: LanguageCode, $country: CountryCode)
    @inContext(language: $language, country: $country) {
    products(first: $pageSize, after: $cursor, sortKey: VENDOR) {
      edges {
        node {
          vendor
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

type BrandPreviewQuery = {
  products?: {
    nodes?: Array<{
      handle?: string | null
      vendor?: string | null
      featuredImage?: {
        url: string
        width?: number | null
        height?: number | null
        altText?: string | null
      } | null
    } | null> | null
  } | null
}

const BRAND_PREVIEW_DOCUMENT = gql`
  query BrandPreview($query: String!, $language: LanguageCode, $country: CountryCode)
    @inContext(language: $language, country: $country) {
    products(first: 1, query: $query) {
      nodes {
        handle
        vendor
        featuredImage {
          url
          width
          height
          altText
        }
      }
    }
  }
`

export type BrandSummary = {
  name: string
  url?: string
  featuredImage?: {
    url: string
    width?: number | null
    height?: number | null
    altText?: string | null
  }
}

type LocalePrefs = {
  language?: string | null
  country?: string | null
}

export type BrandPreview = {
  handle?: string | null
  image?: {
    url: string
    width?: number | null
    height?: number | null
    altText?: string | null
  } | null
}

const PAGE_SIZE = 250
const MAX_PAGES = 40

type FetchArgs = {
  after?: string | null
  locale?: LocalePrefs
}

async function fetchVendorPage({ after, locale }: FetchArgs) {
  return callShopify<ProductVendorIndexQuery>(() =>
    shopifyClient.request(PRODUCT_VENDOR_INDEX_DOCUMENT, {
      pageSize: PAGE_SIZE,
      cursor: after ?? null,
      language: locale?.language as any,
      country: locale?.country as any,
    }),
  )
}

function vendorUrl(name: string) {
  const query = encodeURIComponent(name)
  return `/collections/vendors?q=${query}`
}

function vendorQuery(vendor: string) {
  const escaped = vendor.replace(/"/g, '\\"')
  return `vendor:"${escaped}"`
}

export async function getAllBrands(locale?: LocalePrefs): Promise<BrandSummary[]> {
  const brands = new Set<string>()
  let after: string | null | undefined
  let hasNext = true
  let guard = 0

  while (hasNext && guard < MAX_PAGES) {
    const result = await fetchVendorPage({ after, locale })
    const edges = result?.products?.edges ?? []

    for (const edge of edges) {
      const name = edge?.node?.vendor?.trim()
      if (!name) continue
      brands.add(name)
    }

    const pageInfo = result?.products?.pageInfo
    hasNext = Boolean(pageInfo?.hasNextPage)
    after = pageInfo?.endCursor ?? null
    guard += 1

    if (!hasNext || !after) break
  }

  return Array.from(brands)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, url: vendorUrl(name) }))
}

export async function getBrandPreview(vendor: string, locale?: LocalePrefs): Promise<BrandPreview | null> {
  const trimmed = vendor?.trim()
  if (!trimmed) return null
  const result = await callShopify<BrandPreviewQuery>(() =>
    shopifyClient.request(BRAND_PREVIEW_DOCUMENT, {
      query: vendorQuery(trimmed),
      language: locale?.language as any,
      country: locale?.country as any,
    }),
  )
  const node = result?.products?.nodes?.[0]
  if (!node?.featuredImage?.url) return null
  return {
    handle: node.handle ?? undefined,
    image: {
      url: node.featuredImage.url,
      width: node.featuredImage.width,
      height: node.featuredImage.height,
      altText: node.featuredImage.altText,
    },
  }
}
