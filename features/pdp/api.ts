import { qk } from "@/lib/shopify/queryKeys"
import { getProductByHandle } from "@/lib/shopify/services/products"
import { currentLocale } from "@/store/prefs"
import { useQuery } from "@tanstack/react-query"

export function useProduct(handle: string) {
  const locale = currentLocale()
  return useQuery({
    queryKey: qk.product(handle, locale),
    queryFn: async () => (await getProductByHandle(handle, locale)).product,
  })
}
