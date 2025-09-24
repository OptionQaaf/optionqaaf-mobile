import { qk } from "@/lib/shopify/queryKeys"
import { getAllBrands } from "@/lib/shopify/services/brands"
import { currentLocale } from "@/store/prefs"
import { useQuery } from "@tanstack/react-query"

export function useBrandIndex() {
  const locale = currentLocale()
  return useQuery({
    queryKey: qk.brandIndex(),
    staleTime: 1000 * 60 * 10,
    queryFn: () => getAllBrands(locale),
  })
}
