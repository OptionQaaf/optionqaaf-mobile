import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { gql } from "graphql-tag"

type LocaleInput = { country?: string; language?: string }

export type ForYouCursorState = {
  handleIndex: number
  page: number
  byHandle: Record<string, string | null>
  exhausted: string[]
}

export type ForYouCandidateProduct = {
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
  images?: {
    nodes?: Array<{
      id?: string | null
      url?: string | null
      altText?: string | null
      width?: number | null
      height?: number | null
    } | null> | null
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

const FOR_YOU_COLLECTION_PRODUCTS_DOCUMENT = gql`
  query ForYouCollectionProducts(
    $handle: String!
    $pageSize: Int!
    $after: String
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
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

type ForYouCollectionProductsResult = {
  collection?: {
    products?: {
      pageInfo?: { hasNextPage?: boolean | null; endCursor?: string | null } | null
      nodes?: Array<ForYouCandidateProduct | null> | null
    } | null
  } | null
}

export async function getForYouCollectionProducts(
  args: {
    handle: string
    pageSize?: number
    after?: string | null
    sortKey?: "CREATED" | "BEST_SELLING" | "PRICE" | "COLLECTION_DEFAULT" | "TITLE"
    reverse?: boolean
  },
  locale?: LocaleInput,
): Promise<{
  nodes: ForYouCandidateProduct[]
  cursor: string | null
  hasNext: boolean
}> {
  const data = await callShopify<ForYouCollectionProductsResult>(() =>
    shopifyClient.request(FOR_YOU_COLLECTION_PRODUCTS_DOCUMENT, {
      handle: args.handle,
      pageSize: args.pageSize ?? 40,
      after: args.after ?? null,
      sortKey: args.sortKey ?? "CREATED",
      reverse: args.reverse ?? true,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )

  const page = data.collection?.products
  return {
    nodes: (page?.nodes ?? []).filter((node): node is ForYouCandidateProduct => Boolean(node)),
    cursor: page?.pageInfo?.endCursor ?? null,
    hasNext: Boolean(page?.pageInfo?.hasNextPage),
  }
}

export function decodeForYouCursor(cursor?: string | null, handles?: string[]): ForYouCursorState {
  const uniqueHandles = Array.from(new Set((handles ?? []).filter(Boolean)))
  if (!cursor) {
    return {
      handleIndex: 0,
      page: 0,
      byHandle: Object.fromEntries(uniqueHandles.map((handle) => [handle, null])),
      exhausted: [],
    }
  }

  try {
    const parsed = JSON.parse(cursor) as ForYouCursorState
    return {
      handleIndex: Number.isFinite(parsed.handleIndex) ? Math.max(0, parsed.handleIndex) : 0,
      page: Number.isFinite((parsed as any).page) ? Math.max(0, Number((parsed as any).page)) : 0,
      byHandle: {
        ...Object.fromEntries(uniqueHandles.map((handle) => [handle, null])),
        ...(parsed.byHandle ?? {}),
      },
      exhausted: Array.isArray(parsed.exhausted) ? parsed.exhausted.filter(Boolean) : [],
    }
  } catch {
    return {
      handleIndex: 0,
      page: 0,
      byHandle: Object.fromEntries(uniqueHandles.map((handle) => [handle, null])),
      exhausted: [],
    }
  }
}

export function encodeForYouCursor(state: ForYouCursorState | null): string | undefined {
  if (!state) return undefined
  return JSON.stringify(state)
}

export async function getForYouCandidates(
  input: {
    handles: string[]
    locale?: LocaleInput
    poolSize?: number
    perPage?: number
    cursor?: string | null
  },
): Promise<{ items: ForYouCandidateProduct[]; nextCursor?: string }> {
  const handles = Array.from(new Set(input.handles.map((h) => h.trim()).filter(Boolean)))
  if (!handles.length) return { items: [] }

  const targetPool = Math.max(20, Math.min(400, input.poolSize ?? 200))
  const perPage = Math.max(20, Math.min(100, input.perPage ?? 40))

  const state = decodeForYouCursor(input.cursor, handles)
  const exhausted = new Set(state.exhausted)
  const items: ForYouCandidateProduct[] = []
  const seen = new Set<string>()

  let rounds = 0
  const maxRounds = handles.length * 8

  while (items.length < targetPool && exhausted.size < handles.length && rounds < maxRounds) {
    rounds += 1
    const idx = state.handleIndex % handles.length
    const handle = handles[idx]
    state.handleIndex = (idx + 1) % handles.length

    if (exhausted.has(handle)) continue

    const after = state.byHandle[handle] ?? null
    const page = await getForYouCollectionProducts(
      { handle, pageSize: perPage, after, sortKey: "CREATED", reverse: true },
      input.locale,
    )

    for (const node of page.nodes) {
      if (!node?.id || seen.has(node.id)) continue
      seen.add(node.id)
      items.push(node)
      if (items.length >= targetPool) break
    }

    if (page.hasNext && page.cursor) {
      state.byHandle[handle] = page.cursor
    } else {
      exhausted.add(handle)
      state.byHandle[handle] = null
    }
  }

  state.exhausted = Array.from(exhausted)
  state.page = (Number.isFinite(state.page) ? state.page : 0) + 1

  if (exhausted.size >= handles.length) {
    return { items }
  }

  return {
    items,
    nextCursor: encodeForYouCursor(state),
  }
}
