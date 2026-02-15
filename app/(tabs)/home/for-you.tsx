import { useForYouProducts } from "@/features/for-you/api"
import type { ForYouCandidate } from "@/features/for-you/profile"
import { useForYouFeedStore } from "@/store/forYouFeed"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { Screen } from "@/ui/layout/Screen"
import { ProductTile } from "@/ui/product/ProductTile"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { router } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RefreshControl, ScrollView, Text, useWindowDimensions, View } from "react-native"

const GRID_GAP = 8

export default function ForYouScreen() {
  const feedStoreSetItems = useForYouFeedStore((state) => state.setItems)
  const { width } = useWindowDimensions()
  const [refreshKey, setRefreshKey] = useState(0)
  const query = useForYouProducts({ pageSize: 40, refreshKey })
  const navigation = useNavigation<any>()
  const debugSnapshotRef = useRef<string>("")

  const items = useMemo<ForYouCandidate[]>(() => {
    const merged = (query.data?.pages ?? []).flatMap((page: { items: ForYouCandidate[] }) => page.items ?? [])
    const seen = new Set<string>()
    const deduped: ForYouCandidate[] = []
    for (const item of merged) {
      const key = `${item.id}|${item.handle}`
      if (!item?.id || seen.has(key)) continue
      seen.add(key)
      deduped.push(item)
    }
    return deduped
  }, [query.data])

  const padH = 16
  const columnWidth = Math.floor((width - padH * 2 - GRID_GAP) / 2)
  const isInitialLoading = query.isLoading && !query.data

  const onLoadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
  }, [query])

  const onRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  const rows = useMemo(() => {
    const output: Array<[ForYouCandidate | null, ForYouCandidate | null]> = []
    for (let i = 0; i < items.length; i += 2) {
      output.push([items[i] ?? null, items[i + 1] ?? null])
    }
    return output
  }, [items])

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((prev) => prev + 1)
      return undefined
    }, []),
  )

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", () => {
      setRefreshKey((prev) => prev + 1)
    })
    return unsubscribe
  }, [navigation])

  useEffect(() => {
    if (!__DEV__) return
    if (!items.length) return

    const sample = items.slice(0, 20).map((item, index) => ({
      rank: index + 1,
      id: item.id,
      handle: item.handle,
      title: item.title ?? null,
      vendor: item.vendor ?? null,
      productType: item.productType ?? null,
      tags: item.tags ?? [],
      createdAt: item.createdAt ?? null,
      availableForSale: item.availableForSale ?? null,
      price: item.priceRange?.minVariantPrice?.amount ?? null,
      currency: item.priceRange?.minVariantPrice?.currencyCode ?? null,
    }))
    const signature = sample.map((item) => item.handle).join("|")
    if (signature && signature === debugSnapshotRef.current) return
    debugSnapshotRef.current = signature

    console.debug("[for-you] ranked top 20 sample", JSON.stringify(sample, null, 2))
    const pageDebug = query.data?.pages?.[0]?.debug
    if (pageDebug) {
      console.debug("[for-you] pool debug", pageDebug)
    }
  }, [items, query.data])

  return (
    <Screen bleedTop bleedBottom>
      <View className="flex-1 bg-white">
        {isInitialLoading ? (
          <View style={{ flex: 1, paddingHorizontal: padH, paddingTop: 12, paddingBottom: 120 }}>
            <LoadingMasonry />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: padH, paddingTop: 12, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={onRefresh} />
            }
            onScroll={(event) => {
              const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
              const isNearBottom = contentOffset.y + layoutMeasurement.height + 320 >= contentSize.height
              if (isNearBottom) onLoadMore()
            }}
          >
            {!items.length ? (
              <View className="items-center pt-20">
                <Text className="text-secondary">No personalized products available yet.</Text>
              </View>
            ) : (
              rows.map(([left, right], rowIndex) => (
                <View key={`for-you-row-${rowIndex}`} style={{ flexDirection: "row", marginBottom: GRID_GAP }}>
                  <View style={{ width: columnWidth }}>
                    {left ? (
                      <ForYouTile
                        item={left}
                        index={rowIndex * 2}
                        items={items}
                        columnWidth={columnWidth}
                        onPressItems={feedStoreSetItems}
                      />
                    ) : null}
                  </View>
                  <View style={{ width: GRID_GAP }} />
                  <View style={{ width: columnWidth }}>
                    {right ? (
                      <ForYouTile
                        item={right}
                        index={rowIndex * 2 + 1}
                        items={items}
                        columnWidth={columnWidth}
                        onPressItems={feedStoreSetItems}
                      />
                    ) : null}
                  </View>
                </View>
              ))
            )}
            {query.isFetchingNextPage ? (
              <View style={{ paddingVertical: 16 }}>
                <LoadingMasonry compact />
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Screen>
  )
}

function ForYouTile({
  item,
  index,
  items,
  columnWidth,
  onPressItems,
}: {
  item: ForYouCandidate
  index: number
  items: ForYouCandidate[]
  columnWidth: number
  onPressItems: (items: ForYouCandidate[]) => void
}) {
  const ratio = getMasonryRatio(item.handle)
  const price = Number(item?.priceRange?.minVariantPrice?.amount ?? 0)
  const compareAt = Number(item?.compareAtPriceRange?.minVariantPrice?.amount ?? 0)
  const image = item?.featuredImage?.url ?? item?.images?.nodes?.[0]?.url ?? ""

  return (
    <ProductTile
      image={image}
      brand={item.vendor ?? ""}
      title={item.title ?? ""}
      price={price}
      compareAt={compareAt > price ? compareAt : undefined}
      currency={item?.priceRange?.minVariantPrice?.currencyCode ?? "USD"}
      width={columnWidth}
      imageRatio={ratio}
      padding="sm"
      onPress={() => {
        onPressItems(items)
        router.push({
          pathname: "/products/for-you-feed" as any,
          params: {
            initialIndex: String(index),
            handles: encodeURIComponent(JSON.stringify(items.map((entry) => entry.handle))),
          },
        })
      }}
    />
  )
}

function LoadingMasonry({ compact = false }: { compact?: boolean }) {
  const count = compact ? 4 : 8
  return (
    <View className="w-full" style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
      {Array.from({ length: count }).map((_, idx) => (
        <View key={`fy-skel-${idx}`} style={{ width: "48%", marginBottom: GRID_GAP }}>
          <Skeleton className="w-full rounded-sm" style={{ height: 180 + (idx % 3) * 40 }} />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <Skeleton className="mt-2 h-3 w-3/5" />
        </View>
      ))}
    </View>
  )
}

function getMasonryRatio(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const band = hash % 4
  if (band === 0) return 0.95
  if (band === 1) return 1.15
  if (band === 2) return 1.35
  return 0.82
}
