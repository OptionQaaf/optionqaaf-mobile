import type { ProductSortKeys } from "@/lib/shopify/gql/graphql"
import { qk } from "@/lib/shopify/queryKeys"
import { searchProducts } from "@/lib/shopify/services/products"
import { currentLocale } from "@/store/prefs"
import { useInfiniteQuery } from "@tanstack/react-query"

export function useSearch(
  query: string,
  pageSize = 24,
  options?: { sortKey?: ProductSortKeys | null; reverse?: boolean },
) {
  const locale = currentLocale()
  const sortKey = options?.sortKey ?? null
  const reverse = options?.reverse ?? null
  return useInfiniteQuery({
    enabled: !!query,
    queryKey: qk.search(query, { pageSize, locale, sortKey, reverse }),
    queryFn: async ({ pageParam }) => {
      const res = await searchProducts(
        { query, pageSize, after: pageParam ?? null, sortKey, reverse: reverse ?? false },
        locale,
      )
      const page = res.products
      return {
        nodes: page?.nodes ?? [],
        cursor: page?.pageInfo.endCursor ?? null,
        hasNext: page?.pageInfo.hasNextPage ?? false,
      }
    },
    getNextPageParam: (last) => (last.hasNext ? last.cursor : undefined),
    initialPageParam: null as string | null,
  })
}
