import { getRecommendedProducts } from "@/lib/shopify/services/recommendations"
import { currentLocale } from "@/store/prefs"
import { useQuery } from "@tanstack/react-query"

export function useRecommendedProducts(productId: string) {
  const locale = currentLocale()

  return useQuery({
    queryKey: ["recommended", productId, locale],
    queryFn: async () => {
      const res = await getRecommendedProducts(productId, locale)
      return res.productRecommendations ?? []
    },
  })
}
