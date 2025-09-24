import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { type LocalePrefs } from "@/lib/shopify/env"
import { gql } from "graphql-tag"

type AllVendorsQuery = {
  products?: {
    pageInfo?: { hasNextPage?: boolean | null; endCursor?: string | null } | null
    nodes?:
      | Array<{
          vendor?: string | null
          handle?: string | null
          featuredImage?: {
            url: string
            width?: number | null
            height?: number | null
            altText?: string | null
          } | null
        } | null>
      | null
  } | null
}

const ALL_VENDORS_DOCUMENT = gql`
  query AllVendors($pageSize: Int!, $cursor: String, $language: LanguageCode, $country: CountryCode)
    @inContext(language: $language, country: $country) {
    products(first: $pageSize, after: $cursor, sortKey: VENDOR) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        vendor
        handle
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
  productCount: number
  featuredImage?: {
    url: string
    width?: number | null
    height?: number | null
    altText?: string | null
  }
}

const PAGE_SIZE = 100
const MAX_PAGES = 50

type FetchArgs = {
  after?: string | null
  locale?: LocalePrefs
}

async function fetchPage({ after, locale }: FetchArgs) {
  return callShopify<AllVendorsQuery>(() =>
    shopifyClient.request(ALL_VENDORS_DOCUMENT, {
      pageSize: PAGE_SIZE,
      cursor: after ?? null,
      language: locale?.language as any,
      country: locale?.country as any,
    }),
  )
}

export async function getAllBrands(locale?: LocalePrefs): Promise<BrandSummary[]> {
  const brandMap = new Map<string, BrandSummary>()
  let after: string | null | undefined
  let hasNext = true
  let guard = 0

  while (hasNext && guard < MAX_PAGES) {
    const result = await fetchPage({ after, locale })
    const nodes = result?.products?.nodes ?? []

    for (const node of nodes) {
      const name = node?.vendor?.trim()
      if (!name) continue
      const entry = brandMap.get(name)
      if (entry) {
        entry.productCount += 1
        if (!entry.featuredImage && node?.featuredImage?.url) {
          entry.featuredImage = {
            url: node.featuredImage.url,
            width: node.featuredImage.width,
            height: node.featuredImage.height,
            altText: node.featuredImage.altText,
          }
        }
      } else {
        brandMap.set(name, {
          name,
          productCount: 1,
          featuredImage: node?.featuredImage?.url
            ? {
                url: node.featuredImage.url,
                width: node.featuredImage.width,
                height: node.featuredImage.height,
                altText: node.featuredImage.altText,
              }
            : undefined,
        })
      }
    }

    const pageInfo = result?.products?.pageInfo
    hasNext = Boolean(pageInfo?.hasNextPage)
    after = pageInfo?.endCursor ?? null
    guard += 1

    if (!hasNext) break
    if (!after) break
  }

  const entries = Array.from(brandMap.values())

  entries.sort((a, b) => {
    if (b.productCount !== a.productCount) return b.productCount - a.productCount
    return a.name.localeCompare(b.name)
  })

  return entries
}
