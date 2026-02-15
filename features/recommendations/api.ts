import { getRecommendedProducts } from "@/lib/shopify/services/recommendations"
import type { ProductRecommendationIntent } from "@/lib/shopify/gql/graphql"
import { currentLocale } from "@/store/prefs"
import { useQuery } from "@tanstack/react-query"

export function useRecommendedProducts(input: {
  productId?: string | null
  productHandle?: string | null
  intent?: ProductRecommendationIntent
}) {
  const locale = currentLocale()
  const productId = input.productId ?? null
  const productHandle = input.productHandle ?? null
  const intent = input.intent ?? "RELATED"

  return useQuery({
    enabled: Boolean(productId || productHandle),
    queryKey: ["recommended", productId, productHandle, intent, locale],
    queryFn: async () => {
      const res = await getRecommendedProducts({ productId, productHandle, intent }, locale)
      return res.productRecommendations ?? []
    },
  })
}
