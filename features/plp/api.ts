import { qk } from "@/lib/shopify/queryKeys"
import { getCollectionProducts } from "@/lib/shopify/services/products"
import { currentLocale } from "@/store/prefs"
import { useInfiniteQuery } from "@tanstack/react-query"

export function useCollectionProducts(handle: string, pageSize = 24) {
  const locale = currentLocale()
  return useInfiniteQuery({
    queryKey: qk.plp(handle, { pageSize, locale }),
    queryFn: async ({ pageParam }) => {
      const res = await getCollectionProducts({ handle, pageSize, after: pageParam ?? null }, locale)
      const page = res.collection?.products
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
