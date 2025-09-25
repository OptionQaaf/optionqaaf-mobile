import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { type LocalePrefs } from "@/lib/shopify/env"
import { gql } from "graphql-tag"

type ProductVendorsQuery = {
  shop?: {
    productVendors?: {
      edges?: Array<{ node?: string | null } | null> | null
      pageInfo?: { hasNextPage?: boolean | null; endCursor?: string | null } | null
    } | null
  } | null
}

const PRODUCT_VENDORS_DOCUMENT = gql`
  query ProductVendors($pageSize: Int!, $cursor: String, $language: LanguageCode, $country: CountryCode)
    @inContext(language: $language, country: $country) {
    shop {
      productVendors(first: $pageSize, after: $cursor) {
        edges {
          node
        }
        pageInfo {
          hasNextPage
          endCursor
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

const PAGE_SIZE = 250
const MAX_PAGES = 40

type FetchArgs = {
  after?: string | null
  locale?: LocalePrefs
}

async function fetchVendorPage({ after, locale }: FetchArgs) {
  return callShopify<ProductVendorsQuery>(() =>
    shopifyClient.request(PRODUCT_VENDORS_DOCUMENT, {
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

export async function getAllBrands(locale?: LocalePrefs): Promise<BrandSummary[]> {
  const brands = new Set<string>()
  let after: string | null | undefined
  let hasNext = true
  let guard = 0

  while (hasNext && guard < MAX_PAGES) {
    const result = await fetchVendorPage({ after, locale })
    const edges = result?.shop?.productVendors?.edges ?? []

    for (const edge of edges) {
      const name = edge?.node?.trim()
      if (!name) continue
      brands.add(name)
    }

    const pageInfo = result?.shop?.productVendors?.pageInfo
    hasNext = Boolean(pageInfo?.hasNextPage)
    after = pageInfo?.endCursor ?? null
    guard += 1

    if (!hasNext || !after) break
  }

  return Array.from(brands)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, url: vendorUrl(name) }))
}
