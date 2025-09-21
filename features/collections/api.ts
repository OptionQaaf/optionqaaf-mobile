import { qk } from "@/lib/shopify/queryKeys"
import { getCollectionProducts } from "@/lib/shopify/services/products"
import { currentLocale } from "@/store/prefs"
import { useQuery } from "@tanstack/react-query"

export type CollectionSummary = {
  handle: string
  title: string
  image?: string
}

export function useCollectionsSummary(handles: string[], take = 3) {
  const locale = currentLocale()
  const normalized = handles.filter(Boolean)
  const unique = normalized.filter((handle, index) => normalized.indexOf(handle) === index).slice(0, take)

  const cacheKey = unique.length ? unique.join("|") : "__empty__"

  return useQuery({
    queryKey: qk.collectionsSummary(cacheKey, { locale, take }),
    enabled: unique.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        unique.map(async (handle) => {
          const res = await getCollectionProducts({ handle, pageSize: 1, after: null }, locale)
          const collection = res.collection
          if (!collection) return null
          return {
            handle,
            title: collection.title ?? handle,
            image: (collection.image?.url as string | undefined) ?? undefined,
          }
        }),
      )

      return results.filter((item): item is CollectionSummary => Boolean(item))
    },
  })
}
