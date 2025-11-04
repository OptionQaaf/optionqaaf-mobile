import { qk } from "@/lib/shopify/queryKeys"
import { getCollectionProducts } from "@/lib/shopify/services/products"
import { currentLocale } from "@/store/prefs"
import { useInfiniteQuery } from "@tanstack/react-query"
import { type ProductCollectionSortKeys } from "@/lib/shopify/gql/graphql"

export type CollectionProductsOptions = {
  sortKey?: ProductCollectionSortKeys | null
  reverse?: boolean
}

export function useCollectionProducts(handle: string, pageSize = 24, options: CollectionProductsOptions = {}) {
  const locale = currentLocale()
  const sortKey = options.sortKey ?? null
  const reverse = options.reverse ?? null
  return useInfiniteQuery({
    queryKey: qk.plp(handle, { pageSize, locale, sortKey, reverse }),
    queryFn: async ({ pageParam }) => {
      const res = await getCollectionProducts(
        { handle, pageSize, after: pageParam ?? null, sortKey, reverse },
        locale,
      )
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

export function useCollectionMeta(handle: string) {
  const locale = currentLocale()
  return useInfiniteQuery({
    queryKey: qk.plp(`${handle}:meta`, { pageSize: 1, locale }),
    queryFn: async () => {
      const res = await getCollectionProducts({ handle, pageSize: 1, after: null }, locale)
      return { title: res.collection?.title ?? handle, image: res.collection?.image?.url as any }
    },
    initialPageParam: null as null,
    getNextPageParam: () => undefined,
  })
}
