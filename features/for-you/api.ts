import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { getProfileHash } from "@/features/for-you/profile"
import { flushForYouTracking } from "@/features/for-you/tracking"
import { getForYouProducts, getForYouProfile } from "@/features/for-you/service"
import { qk } from "@/lib/shopify/queryKeys"
import { currentLocale } from "@/store/prefs"
import { type InfiniteData, useInfiniteQuery, useQuery } from "@tanstack/react-query"

type ForYouProductsPage = Awaited<ReturnType<typeof getForYouProducts>>

export function useForYouProfile() {
  const locale = currentLocale()
  const { isAuthenticated } = useShopifyAuth()
  const { data: customer } = useCustomerProfile({ enabled: isAuthenticated })
  const customerId = customer?.id ?? null

  return useQuery({
    queryKey: qk.forYou.profile(locale, customerId),
    queryFn: async () => getForYouProfile(),
  })
}

export function useForYouProducts({
  pageSize = 40,
  cursor,
  refreshKey = 0,
}: { pageSize?: number; cursor?: string | null; refreshKey?: number } = {}) {
  const locale = currentLocale()
  const profileQuery = useForYouProfile()
  const profile = profileQuery.data
  const gender = profile?.gender ?? "unknown"
  const profileHash = profile ? getProfileHash(profile) : "none"

  return useInfiniteQuery<
    ForYouProductsPage,
    Error,
    InfiniteData<ForYouProductsPage>,
    ReturnType<typeof qk.forYou.products>,
    string | null
  >({
    enabled: profileQuery.isSuccess,
    queryKey: qk.forYou.products(locale, gender, profileHash, pageSize, null, refreshKey),
    initialPageParam: cursor ?? null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    queryFn: async ({ pageParam }) =>
      {
        await flushForYouTracking().catch(() => {})
        return getForYouProducts({
          locale,
          pageSize,
          cursor: pageParam,
          refreshKey,
          includeDebug: __DEV__,
        })
      },
  })
}
