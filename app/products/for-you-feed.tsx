import { useAddToCart, useCartQuery, useEnsureCart } from "@/features/cart/api"
import { useForYouReel } from "@/features/fyp/reelApi"
import { useFypTrackingStore } from "@/features/fyp/trackingStore"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { AddToCart } from "@/ui/product/AddToCart"
import { VariantDropdown } from "@/ui/product/VariantDropdown"
import * as ExpoLinking from "expo-linking"
import { router, useLocalSearchParams } from "expo-router"
import { ChevronLeft, Share2, ShoppingBag } from "lucide-react-native"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, Share, Text, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

function normalizeHandle(input: unknown): string {
  if (typeof input !== "string") return ""
  return input.trim().toLowerCase()
}

type ReelHeaderOverlayProps = {
  vendor: string
  insetsTop: number
  cartQty: number
  onBack: () => void
  onShare: () => void
  onOpenCart: () => void
}

const ReelHeaderOverlay = memo(function ReelHeaderOverlay({
  vendor,
  insetsTop,
  cartQty,
  onBack,
  onShare,
  onOpenCart,
}: ReelHeaderOverlayProps) {
  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 z-50" style={{ top: insetsTop + 8 }}>
      <View className="flex-row items-center justify-between px-4">
        <View className="flex-row items-center gap-3">
          <PressableOverlay
            onPress={onBack}
            className="h-10 w-10 items-center justify-center rounded-full bg-black/40"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={22} color="#ffffff" />
          </PressableOverlay>
          {/* <BrandBadge vendor={vendor} /> */}
        </View>

        <View className="flex-row items-center gap-2">
          <PressableOverlay
            onPress={onShare}
            className="h-10 w-10 items-center justify-center rounded-full bg-black/40"
            accessibilityLabel="Share product"
          >
            <Share2 size={18} color="#ffffff" />
          </PressableOverlay>
          <PressableOverlay
            onPress={onOpenCart}
            className="h-10 w-10 items-center justify-center rounded-full bg-black/40"
            accessibilityLabel="Open cart"
          >
            <ShoppingBag size={18} color="#ffffff" />
            {cartQty > 0 ? (
              <View className="absolute right-1 top-1 min-w-4 rounded-full bg-brand px-1 items-center justify-center">
                <Text className="text-[10px] text-white font-geist-semibold" numberOfLines={1}>
                  {cartQty}
                  {cartQty === 99 ? "+" : ""}
                </Text>
              </View>
            ) : null}
          </PressableOverlay>
        </View>
      </View>
    </View>
  )
})

type ReelItemProps = {
  product: any
  viewportHeight: number
  viewportWidth: number
  bottomInset: number
}

const ReelItem = memo(function ReelItem({ product, viewportHeight, viewportWidth, bottomInset }: ReelItemProps) {
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
    const handle = String(product?.handle ?? "").trim()
    if (!handle) return
    recordView(handle)
  }, [product?.handle, recordView])

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
    <View style={{ height: viewportHeight, width: viewportWidth }} className="bg-black">
      <View className="absolute inset-0 z-0">
        {/* <ProductImageCarousel images={images} width={viewportWidth} height={viewportHeight} /> */}
      </View>

      <View pointerEvents="none" className="absolute inset-0 z-10 bg-black/20" />

      <View className="absolute bottom-0 left-0 right-0 z-20" style={{ paddingBottom: bottomInset + 18 }}>
        <View className="px-4 pb-3">
          <Text className="text-[20px] font-geist-semibold text-white" numberOfLines={2}>
            {product?.title ?? ""}
          </Text>
          <Text className="mt-1 text-[13px] text-white/85" numberOfLines={1}>
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

          <AddToCart
            price={price}
            compareAt={compareAt}
            currency={currency}
            available={available}
            loading={loading}
            onAdd={() => {
              void handleAdd()
            }}
            className="mt-1 bg-white/95"
          />
        </View>
      </View>
    </View>
  )
})

export default function ForYouFeedScreen() {
  const { seed, open } = useLocalSearchParams<{ seed?: string; open?: string }>()
  const seedHandle = typeof seed === "string" ? seed : ""
  const sessionKey = typeof open === "string" ? open : ""
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } = useForYouReel(
    seedHandle,
    refreshKey,
    sessionKey,
  )
  const { data: cart } = useCartQuery()

  const products = useMemo(() => {
    return data?.pages?.flatMap((page) => page.items) ?? []
  }, [data])

  const cartQty = Math.min(99, cart?.totalQuantity ?? 0)
  const activeProduct = products[activeIndex] ?? products[0] ?? null
  const activeVendor = String(activeProduct?.vendor ?? "")

  const listRef = useRef<FlatList<any> | null>(null)
  const hasNextRef = useRef(hasNextPage)
  const fetchingNextRef = useRef(isFetchingNextPage)
  const productsLengthRef = useRef(products.length)

  useEffect(() => {
    hasNextRef.current = hasNextPage
    fetchingNextRef.current = isFetchingNextPage
    productsLengthRef.current = products.length
  }, [hasNextPage, isFetchingNextPage, products.length])

  const itemHeight = height

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    const sorted = viewableItems
      .map((item) => item.index)
      .filter((index): index is number => typeof index === "number" && index >= 0)
      .sort((a, b) => a - b)

    const leadIndex = sorted[0] ?? -1
    if (leadIndex >= 0) {
      setActiveIndex(leadIndex)
    }

    const maxVisibleIndex = sorted[sorted.length - 1] ?? -1
    if (maxVisibleIndex < 0) return
    if (!hasNextRef.current || fetchingNextRef.current) return
    if (productsLengthRef.current - 1 - maxVisibleIndex <= 2) {
      void fetchNextPage()
    }
  }).current

  useEffect(() => {
    if (products.length <= activeIndex) {
      setActiveIndex(Math.max(0, products.length - 1))
    }
  }, [products.length, activeIndex])

  const handleBack = useCallback(() => {
    router.back()
  }, [])

  const handleOpenCart = useCallback(() => {
    router.push("/cart" as any)
  }, [])

  const handleShare = useCallback(async () => {
    const handle = normalizeHandle(activeProduct?.handle)
    if (!handle) return
    const title = String(activeProduct?.title ?? "Product")
    const productUrl = ExpoLinking.createURL(`/products/${handle}`)
    try {
      await Share.share({
        message: productUrl,
        url: productUrl,
        title,
      })
    } catch {}
  }, [activeProduct])

  return (
    <Screen bleedTop bleedBottom>
      <View className="flex-1 bg-black">
        <View className="absolute inset-0 z-0">
          <FlatList
            ref={listRef}
            data={products}
            keyExtractor={(item: any, index) => {
              const handle = String(item?.handle ?? "")
                .trim()
                .toLowerCase()
              return `${handle || String(item?.id ?? "reel")}::${index}`
            }}
            renderItem={({ item }) => (
              <ReelItem product={item} viewportHeight={itemHeight} viewportWidth={width} bottomInset={insets.bottom} />
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + 18 }}
            snapToInterval={itemHeight}
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
                <View style={{ height: itemHeight, width }}>
                  <Skeleton className="h-full w-full" />
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
          />
        </View>

        <ReelHeaderOverlay
          vendor={activeVendor}
          insetsTop={insets.top}
          cartQty={cartQty}
          onBack={handleBack}
          onShare={handleShare}
          onOpenCart={handleOpenCart}
        />
      </View>
    </Screen>
  )
}
