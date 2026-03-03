import { getRecentlyViewedOnlyHandles } from "@/lib/personalization/events"
import { qk } from "@/lib/shopify/queryKeys"
import { getProductsByHandles } from "@/lib/shopify/services/products"
import { usePersonalizationEvents } from "@/store/personalizationEvents"
import { currentLocale } from "@/store/prefs"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

export type RecentlyViewedProduct = {
  productId: string
  handle: string
  title: string
  vendor: string
  imageUrl: string | null
  price: number
  currencyCode: string
}

function toRecentlyViewedProduct(node: any): RecentlyViewedProduct | null {
  const handle = typeof node?.handle === "string" ? node.handle : ""
  const productId = typeof node?.id === "string" ? node.id : ""
  if (!handle || !productId) return null

  const amount = Number(node?.priceRange?.minVariantPrice?.amount ?? 0)
  const currencyCode = String(node?.priceRange?.minVariantPrice?.currencyCode ?? "USD")

  return {
    productId,
    handle,
    title: typeof node?.title === "string" ? node.title : "Product",
    vendor: typeof node?.vendor === "string" ? node.vendor : "",
    imageUrl: typeof node?.featuredImage?.url === "string" ? node.featuredImage.url : null,
    price: Number.isFinite(amount) ? amount : 0,
    currencyCode,
  }
}

export function useRecentlyViewedProducts(limit = 24) {
  const locale = currentLocale()
  const profile = usePersonalizationEvents((state) => state.profile)

  const handles = useMemo(() => getRecentlyViewedOnlyHandles(profile, limit), [limit, profile])

  const query = useQuery({
    enabled: handles.length > 0,
    queryKey: qk.personalization.recentlyViewed(handles, locale),
    queryFn: async () => {
      const products = await getProductsByHandles(handles, locale)
      const byHandle = new Map<string, RecentlyViewedProduct>()
      for (const node of products) {
        const mapped = toRecentlyViewedProduct(node)
        if (!mapped) continue
        byHandle.set(mapped.handle.toLowerCase(), mapped)
      }
      return handles
        .map((handle) => byHandle.get(handle.toLowerCase()))
        .filter((item): item is RecentlyViewedProduct => !!item)
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    handles,
    data: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  }
}
