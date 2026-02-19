import { useAddToCart, useEnsureCart } from "@/features/cart/api"
import { useForYouReel } from "@/features/fyp/reelApi"
import { useFypTrackingStore } from "@/features/fyp/trackingStore"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { ImageCarousel } from "@/ui/media/ImageCarousel"
import { AddToCart } from "@/ui/product/AddToCart"
import { VariantDropdown } from "@/ui/product/VariantDropdown"
import { router, useLocalSearchParams } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Text, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

function ReelItem({ product, cardHeight, cardWidth }: { product: any; cardHeight: number; cardWidth: number }) {
  const ensure = useEnsureCart()
  const add = useAddToCart()
  const recordView = useFypTrackingStore((state) => state.recordView)
  const options = useMemo<{ name: string; values: string[] }[]>(() => product?.options ?? [], [product])
  const visibleOptions = useMemo(() => options.slice(0, 2), [options])
  const variants = useMemo<any[]>(() => product?.variants?.nodes ?? [], [product])
  const inStockVariants = useMemo(() => variants.filter((entry) => entry?.availableForSale !== false), [variants])
  const variantsPool = inStockVariants.length ? inStockVariants : variants
  const [selected, setSelected] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!visibleOptions.length) return
    setSelected((prev) => {
      const next = { ...prev }
      const seedVariant = variantsPool[0] ?? variants[0]
      for (const opt of seedVariant?.selectedOptions ?? []) {
        if (opt?.name && opt?.value) next[opt.name] = opt.value
      }
      for (const opt of visibleOptions) {
        if (!next[opt.name]) next[opt.name] = opt.values[0]
      }
      return next
    })
  }, [visibleOptions, variants, variantsPool])

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null
    const pool = variantsPool.length ? variantsPool : variants
    return (
      pool.find((entry) =>
        (entry?.selectedOptions ?? []).every((opt: any) => String(selected[opt.name]) === String(opt.value)),
      ) ??
      pool[0] ??
      variants[0] ??
      null
    )
  }, [variants, variantsPool, selected])

  const images = useMemo(() => {
    const urls: string[] = []
    const vUrl = selectedVariant?.image?.url as string | undefined
    if (vUrl) urls.push(vUrl)
    for (const media of product?.media?.nodes ?? []) {
      const url = media?.image?.url as string | undefined
      if (url) urls.push(url)
    }
    const featured = product?.featuredImage?.url as string | undefined
    if (featured) urls.push(featured)
    const unique = Array.from(new Set(urls.filter(Boolean)))
    return unique.length ? unique : [""]
  }, [product, selectedVariant])

  const currency = String(selectedVariant?.price?.currencyCode ?? "USD")
  const price = Number(selectedVariant?.price?.amount ?? 0)
  const compareAt = selectedVariant?.compareAtPrice?.amount ? Number(selectedVariant.compareAtPrice.amount) : undefined
  const available = selectedVariant?.availableForSale !== false
  const loading = ensure.isPending || add.isPending
  const imageHeightRatio = visibleOptions.length >= 2 ? 0.54 : visibleOptions.length === 1 ? 0.62 : 0.7
  const imageHeight = Math.round(cardHeight * imageHeightRatio)

  const handleAdd = async () => {
    if (!selectedVariant?.id) return
    try {
      if (!ensure.isSuccess && !ensure.isPending) await ensure.mutateAsync()
      await add.mutateAsync({
        merchandiseId: String(selectedVariant.id),
        quantity: 1,
        tracking: { handle: product?.handle },
      })
    } catch {}
  }

  return (
    <View
      className="rounded-3xl overflow-hidden border border-black/10 bg-white"
      style={{ height: cardHeight }}
      onLayout={() => {
        if (product?.handle) recordView(String(product.handle))
      }}
    >
      <View style={{ height: imageHeight }}>
        <ImageCarousel images={images} width={cardWidth} />
      </View>
      <View className="flex-1 px-4 pt-3 pb-3">
        <Text className="text-[18px] font-geist-semibold text-primary" numberOfLines={2}>
          {product?.title ?? ""}
        </Text>
        <Text className="mt-1 text-secondary text-[13px]" numberOfLines={1}>
          {product?.vendor ?? ""}
        </Text>
        <View className="mt-2">
          {visibleOptions.map((opt) => (
            <VariantDropdown
              key={opt.name}
              label={opt.name}
              options={opt.values.map((value) => ({ id: value, label: value }))}
              value={selected[opt.name]}
              onChange={(value) => setSelected((prev) => ({ ...prev, [opt.name]: value }))}
              className="mb-1.5"
              maxHeight={180}
            />
          ))}
        </View>
        <View className="mt-auto">
          <AddToCart
            price={price}
            compareAt={compareAt}
            currency={currency}
            available={available}
            loading={loading}
            onAdd={() => {
              void handleAdd()
            }}
          />
        </View>
      </View>
    </View>
  )
}

export default function ForYouFeedScreen() {
  const { seed, open } = useLocalSearchParams<{ seed?: string; open?: string }>()
  const seedHandle = typeof seed === "string" ? seed : ""
  const sessionKey = typeof open === "string" ? open : ""
  const [refreshKey, setRefreshKey] = useState(0)
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } = useForYouReel(
    seedHandle,
    refreshKey,
    sessionKey,
  )

  const products = useMemo(() => {
    return data?.pages?.flatMap((page) => page.items) ?? []
  }, [data])

  const availableHeight = Math.max(400, height - insets.top)
  const cardHeight = Math.floor(availableHeight * 0.84)
  const cardWidth = Math.max(0, Math.round(width - 28))
  const itemGap = Math.max(10, Math.floor(availableHeight * 0.03))
  const itemStep = cardHeight + itemGap
  const minItemsBeforeManualScroll = 6
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    const maxVisibleIndex = viewableItems.reduce((max, item) => Math.max(max, item.index ?? -1), -1)
    if (maxVisibleIndex < 0) return
    if (!hasNextPage || isFetchingNextPage) return
    if (products.length - 1 - maxVisibleIndex <= 2) {
      void fetchNextPage()
    }
  }).current

  useEffect(() => {
    if (products.length >= minItemsBeforeManualScroll) return
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [products.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <Screen bleedTop bleedBottom>
      <View className="flex-1 bg-[#f8fafc]">
        <View className="absolute left-4 z-50" style={{ top: insets.top + 8 }}>
          <PressableOverlay
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/85 border border-black/10"
          >
            <ChevronLeft size={20} color="#0b0b0b" />
          </PressableOverlay>
        </View>

        <FlatList
          data={products}
          keyExtractor={(item: any, index) => {
            const handle = String(item?.handle ?? "")
              .trim()
              .toLowerCase()
            return `${handle || String(item?.id ?? "reel")}::${index}`
          }}
          renderItem={({ item }) => (
            <View style={{ height: itemStep, paddingHorizontal: 14, paddingTop: 12 }}>
              <ReelItem product={item} cardHeight={cardHeight} cardWidth={cardWidth} />
            </View>
          )}
          contentContainerStyle={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 18 }}
          snapToInterval={itemStep}
          decelerationRate="fast"
          onEndReachedThreshold={0.75}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage()
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          refreshing={isRefetching}
          onRefresh={() => {
            setRefreshKey((prev) => prev + 1)
            void refetch()
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ height: itemStep, paddingHorizontal: 14, paddingTop: 12 }}>
                <View className="h-full rounded-3xl overflow-hidden border border-black/10 bg-white">
                  <Skeleton className="h-[62%] w-full" />
                  <View className="px-4 py-3">
                    <Skeleton className="h-5 w-3/4 rounded-full" />
                    <Skeleton className="mt-2 h-4 w-1/2 rounded-full" />
                    <Skeleton className="mt-4 h-12 w-full rounded-xl" />
                    <Skeleton className="mt-3 h-12 w-full rounded-xl" />
                    <Skeleton className="mt-4 h-12 w-full rounded-xl" />
                  </View>
                </View>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Screen>
  )
}
