import { getProfileHash, normalizeGender } from "@/features/for-you/profile"
import { getForYouReelPage } from "@/features/for-you/reelService"
import { useForYouProfile } from "@/features/for-you/api"
import { qk } from "@/lib/shopify/queryKeys"
import { currentLocale } from "@/store/prefs"
import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query"

type ReelPage = Awaited<ReturnType<typeof getForYouReelPage>>

export function useForYouReelInfinite({
  seedHandle,
  pageSize = 14,
  refreshKey = 0,
}: {
  seedHandle?: string | null
  pageSize?: number
  refreshKey?: number
}) {
  const locale = currentLocale()
  const profileQuery = useForYouProfile()
  const profile = profileQuery.data
  const profileHash = profile ? getProfileHash(profile) : "none"
  const gender = normalizeGender(profile?.gender)
  const normalizedSeed = typeof seedHandle === "string" ? seedHandle.trim() : ""

  return useInfiniteQuery<ReelPage, Error, InfiniteData<ReelPage>, ReturnType<typeof qk.forYou.reel>, string | null>({
    enabled: profileQuery.isSuccess && Boolean(normalizedSeed),
    queryKey: qk.forYou.reel(normalizedSeed, locale, gender, profileHash, pageSize, refreshKey),
    initialPageParam: null,
    getNextPageParam: (last) => last.cursor ?? undefined,
    queryFn: async ({ pageParam }) =>
      getForYouReelPage({
        seedHandle: normalizedSeed,
        cursor: pageParam,
        pageSize,
        locale,
        includeDebug: __DEV__,
        profile: profile ?? null,
        refreshKey,
      }),
  })
}
