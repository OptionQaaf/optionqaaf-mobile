import { useForYouProducts } from "@/features/fyp/api"
import { useFypTrackingStore } from "@/features/fyp/trackingStore"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { padToFullRow } from "@/ui/layout/gridUtils"
import { Screen } from "@/ui/layout/Screen"
import { ProductTile } from "@/ui/product/ProductTile"
import { ProductTileSkeleton } from "@/ui/product/ProductTileSkeleton"
import { useIsFocused } from "@react-navigation/native"
import { router } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { DeviceEventEmitter, FlatList, Text, useWindowDimensions, View } from "react-native"

export default function ForYouScreen() {
  const recordView = useFypTrackingStore((state) => state.recordView)
  const isFocused = useIsFocused()
  const [refreshKey, setRefreshKey] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const { data, isPending, isFetching, isFetchingNextPage, isRefetching, fetchNextPage, hasNextPage, refetch } =
    useForYouProducts(40, refreshKey, isFocused)
  const listRef = useRef<FlatList<any> | null>(null)

  const products = useMemo(() => {
    const seen = new Set<string>()
    const merged = (data?.pages?.flatMap((page) => page.nodes) ?? []).filter((item) => item?.availableForSale !== false)
    return merged.filter((item) => {
      const handle = String(item?.handle ?? "")
        .trim()
        .toLowerCase()
      if (!handle || seen.has(handle)) return false
      seen.add(handle)
      return true
    })
  }, [data])

  const showRefreshSkeleton = isPullRefreshing && (isRefetching || isFetching || isPending)
  const visibleProducts = useMemo(() => (showRefreshSkeleton ? [] : products), [showRefreshSkeleton, products])
  const gridData = useMemo(() => padToFullRow(visibleProducts, 2), [visibleProducts])
  const { width } = useWindowDimensions()
  const padH = 16
  const gap = 8
  const itemW = Math.floor((width - padH * 2 - gap) / 2)

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener("fyp:tabReselect", () => {
      listRef.current?.scrollToOffset({ animated: true, offset: 0 })
      refetch()
    })
    return () => subscription.remove()
  }, [refetch])

  useEffect(() => {
    if (!isPullRefreshing) return
    if (isFetching || isPending) return
    setIsPullRefreshing(false)
  }, [isPullRefreshing, isFetching, isPending])

  const showInitialSkeletons = showRefreshSkeleton || isPending || (isFetching && visibleProducts.length === 0)

  return (
    <Screen bleedTop bleedBottom>
      <FlatList
        ref={listRef}
        data={gridData}
        keyExtractor={(item: any, index) => (item ? `${item.id ?? item.handle ?? index}` : `fyp-gap-${index}`)}
        numColumns={2}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ paddingHorizontal: padH, paddingTop: 24, paddingBottom: 48, rowGap: gap }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
          }
        }}
        refreshing={(isRefetching && !isFetchingNextPage) || isPullRefreshing}
        onRefresh={() => {
          setIsPullRefreshing(true)
          setRefreshKey((prev) => prev + 1)
        }}
        ListHeaderComponent={
          <View className="mb-2">
            <Text className="text-[24px] font-geist-bold text-primary">For You</Text>
            <Text className="mt-1 text-secondary">Personalized picks with fresh drops.</Text>

            {showInitialSkeletons ? (
              <View className="mt-5 flex-row flex-wrap justify-between" style={{ rowGap: gap }}>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <View key={`fyp-skeleton-${idx}`} style={{ width: itemW }}>
                    <ProductTileSkeleton width={itemW} imageRatio={3 / 4} padding="sm" />
                  </View>
                ))}
              </View>
            ) : null}

            {!showInitialSkeletons && !visibleProducts.length ? (
              <View className="items-center py-16">
                <Text className="text-primary font-geist-semibold text-[17px]">No products available right now</Text>
                <Text className="mt-1 text-secondary">Pull down to refresh and try again.</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }: any) => {
          if (!item) return <View style={{ width: itemW }} />
          return (
            <View style={{ width: itemW }}>
              <ProductTile
                image={item?.featuredImage?.url ?? ""}
                brand={item?.vendor ?? ""}
                title={item?.title ?? ""}
                price={Number(item?.priceRange?.minVariantPrice?.amount ?? 0)}
                compareAt={(() => {
                  const cmp = Number(item?.compareAtPriceRange?.minVariantPrice?.amount ?? 0)
                  const amt = Number(item?.priceRange?.minVariantPrice?.amount ?? 0)
                  return cmp > amt ? cmp : undefined
                })()}
                currency={(item?.priceRange?.minVariantPrice?.currencyCode as string | undefined) ?? "USD"}
                width={itemW}
                imageRatio={3 / 4}
                padding="sm"
                priority={index < 8 ? "high" : "normal"}
                onPress={() => {
                  const handle = String(item?.handle ?? "").trim()
                  if (!handle) return
                  recordView(handle)
                  router.push({
                    pathname: "/products/for-you-feed",
                    params: { seed: handle, open: String(Date.now()) },
                  } as any)
                }}
              />
            </View>
          )
        }}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="pt-4">
              <View className="flex-row justify-between">
                <View style={{ width: itemW }}>
                  <ProductTileSkeleton width={itemW} imageRatio={3 / 4} padding="sm" />
                </View>
                <View style={{ width: itemW }}>
                  <ProductTileSkeleton width={itemW} imageRatio={3 / 4} padding="sm" />
                </View>
              </View>
              <View className="mt-3 items-center">
                <Skeleton className="h-3 w-24 rounded-full" />
              </View>
            </View>
          ) : null
        }
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  )
}
