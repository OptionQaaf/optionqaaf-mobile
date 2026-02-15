import { useAddToCart, useEnsureCart } from "@/features/cart/api"
import { FypDebugPanel } from "@/features/debug/FypDebugPanel"
import { addFypDebugProductPayload, FYP_DEBUG, fypLogOnce } from "@/features/debug/fypDebug"
import { extractForYouContentSignals } from "@/features/for-you/contentSignals"
import type { ForYouCandidate } from "@/features/for-you/profile"
import { useForYouReelInfinite } from "@/features/for-you/reelApi"
import { trackForYouEvent } from "@/features/for-you/tracking"
import { useProduct } from "@/features/pdp/api"
import { qk } from "@/lib/shopify/queryKeys"
import { getProductByHandle } from "@/lib/shopify/services/products"
import { useForYouFeedStore } from "@/store/forYouFeed"
import { currentLocale } from "@/store/prefs"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { ImageCarousel } from "@/ui/media/ImageCarousel"
import { MenuBar } from "@/ui/nav/MenuBar"
import { AddToCart } from "@/ui/product/AddToCart"
import { useQueryClient } from "@tanstack/react-query"
import { useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewToken,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const REEL_HEIGHT_RATIO = 0.79
const FLOATING_MENU_BAR_CONTENT_HEIGHT = 54
const REEL_PAGE_SIZE = 14
const DWELL_MS = 8000

export default function ForYouFeedScreen() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { show } = useToast()
  const qc = useQueryClient()
  const locale = currentLocale()
  const params = useLocalSearchParams<{ initialIndex?: string; handles?: string }>()
  const initialIndex = Math.max(0, Number(params.initialIndex ?? 0) || 0)
  const storedItems = useForYouFeedStore((state) => state.items)

  const handlesFromParams = useMemo(() => {
    if (typeof params.handles !== "string" || !params.handles) return [] as string[]
    try {
      const decoded = JSON.parse(decodeURIComponent(params.handles))
      if (Array.isArray(decoded)) {
        return decoded.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      }
    } catch {
      return []
    }
    return []
  }, [params.handles])

  const baseItems = useMemo<ForYouCandidate[]>(() => {
    if (storedItems.length) return storedItems
    return handlesFromParams.map((handle) => ({ id: handle, handle, title: handle }))
  }, [storedItems, handlesFromParams])

  const seedIndex = Math.min(initialIndex, Math.max(0, baseItems.length - 1))
  const seedItem = baseItems[seedIndex] ?? null
  const reelQuery = useForYouReelInfinite({ seedHandle: seedItem?.handle ?? null, pageSize: REEL_PAGE_SIZE })

  const feedItems = useMemo(() => {
    const flattened = (reelQuery.data?.pages ?? []).flatMap((page) => page.items ?? [])
    const merged = seedItem ? [seedItem, ...flattened] : flattened
    const seen = new Set<string>()
    const out: ForYouCandidate[] = []
    for (const item of merged) {
      const handle = normalize(item?.handle)
      if (!handle || seen.has(handle)) continue
      seen.add(handle)
      out.push(item)
    }
    return out
  }, [reelQuery.data?.pages, seedItem])

  const debugByHandle = useMemo(() => {
    if (!__DEV__) return {} as Record<string, string>
    const map: Record<string, string> = {}
    for (const page of reelQuery.data?.pages ?? []) {
      for (const entry of page.debug?.sample ?? []) {
        map[entry.handle] =
          `seed=${entry.debug?.seedSimilarity?.toFixed?.(2) ?? "0"} affinity=${entry.debug?.userAffinity?.toFixed?.(2) ?? "0"} exp=${entry.debug?.exploration?.toFixed?.(2) ?? "0"} penalty=${entry.debug?.categoryPenalty?.toFixed?.(2) ?? "0"} cat=${entry.category}`
      }
    }
    return map
  }, [reelQuery.data?.pages])

  const [activeIndex, setActiveIndex] = useState(0)
  const seenHandlesRef = useRef<Set<string>>(new Set())
  const dwellFiredRef = useRef<Set<string>>(new Set())
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setActiveIndex(0)
    seenHandlesRef.current = new Set()
    dwellFiredRef.current = new Set()
  }, [seedItem?.handle])

  useEffect(() => {
    const active = feedItems[activeIndex]
    if (!active?.handle) return
    if (!seenHandlesRef.current.has(active.handle)) {
      seenHandlesRef.current.add(active.handle)
      trackForYouEvent({
        type: "product_open",
        handle: active.handle,
        vendor: active.vendor ?? null,
        productType: active.productType ?? null,
        tags: active.tags ?? null,
      })
    }

    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current)
    if (!dwellFiredRef.current.has(active.handle)) {
      dwellTimerRef.current = setTimeout(() => {
        dwellFiredRef.current.add(active.handle)
        trackForYouEvent({
          type: "time_on_product_>8s",
          handle: active.handle,
          vendor: active.vendor ?? null,
          productType: active.productType ?? null,
          tags: active.tags ?? null,
        })
      }, DWELL_MS)
    }

    return () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current)
        dwellTimerRef.current = null
      }
    }
  }, [activeIndex, feedItems])

  useEffect(() => {
    for (let i = activeIndex + 1; i <= activeIndex + 2; i += 1) {
      const handle = feedItems[i]?.handle
      if (!handle) continue
      qc.prefetchQuery({
        queryKey: qk.product(handle, locale),
        queryFn: async () => (await getProductByHandle(handle, locale)).product,
      })
    }
  }, [activeIndex, feedItems, qc, locale])

  useEffect(() => {
    if (!FYP_DEBUG) return
    const firstDebug = reelQuery.data?.pages?.[0]?.debug
    if (firstDebug) {
      fypLogOnce(
        `[for-you][reel] debug:${seedItem?.handle ?? "unknown"}:${firstDebug.poolSize}:${firstDebug.rankMs}`,
        "REEL_DEBUG",
        firstDebug,
      )
    }
  }, [reelQuery.data?.pages, seedItem?.handle])

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((token) => token.isViewable)
    if (typeof first?.index === "number") setActiveIndex(first.index)
  }).current

  const reelHeight = Math.max(460, Math.floor(height * REEL_HEIGHT_RATIO))
  const reelPeek = Math.max(40, height - reelHeight)
  const topOffset = insets.top + FLOATING_MENU_BAR_CONTENT_HEIGHT

  if (!feedItems.length && reelQuery.isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-primary font-geist-semibold text-[16px]">Loading For You feed...</Text>
      </View>
    )
  }

  if (!feedItems.length) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-primary font-geist-semibold text-[16px]">No For You feed items available.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <MenuBar floating back />
      <FlatList
        data={feedItems}
        keyExtractor={(item) => `${item.id ?? item.handle}-${item.handle}`}
        renderItem={({ item }) => (
          <FeedProductPage
            seed={item}
            itemHeight={reelHeight}
            cardWidth={width - 20}
            onError={show}
            debugReason={debugByHandle[item.handle]}
          />
        )}
        snapToInterval={reelHeight}
        decelerationRate="fast"
        snapToAlignment="start"
        getItemLayout={(_, index) => ({ length: reelHeight, offset: reelHeight * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={4}
        initialNumToRender={2}
        scrollEventThrottle={16}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (!reelQuery.hasNextPage || reelQuery.isFetchingNextPage) return
          reelQuery.fetchNextPage()
        }}
        contentContainerStyle={{ paddingTop: topOffset, paddingBottom: reelPeek + 8 }}
      />
      <FypDebugPanel side="left" />
    </View>
  )
}

function FeedProductPage({
  seed,
  itemHeight,
  cardWidth,
  onError,
  debugReason,
}: {
  seed: ForYouCandidate
  itemHeight: number
  cardWidth: number
  onError: (input: { title: string; type?: "danger" | "success" | "info" }) => void
  debugReason?: string
}) {
  const handle = seed.handle
  const { data: product, isLoading } = useProduct(handle)
  const ensure = useEnsureCart()
  const add = useAddToCart()

  const options = useMemo<{ name: string; values: string[] }[]>(
    () => ((product as any)?.options ?? []) as any,
    [product],
  )
  const variants = useMemo<any[]>(() => ((product as any)?.variants?.nodes ?? []) as any[], [product])
  const firstVariant = useMemo(
    () => variants.find((variant) => variant?.availableForSale !== false) ?? variants[0],
    [variants],
  )
  const [sel, setSel] = useState<Record<string, string>>({})
  const depthFired75Ref = useRef(false)
  const depthFired100Ref = useRef(false)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    if (!FYP_DEBUG) return
    const payload = (product as any) ?? null
    const resolvedHandle = String(payload?.handle ?? handle ?? "")
    if (!resolvedHandle || !payload) return
    addFypDebugProductPayload("pdp/useProduct", resolvedHandle, payload)
  }, [product, handle])

  useEffect(() => {
    const source = firstVariant
    if (!source) return
    const next: Record<string, string> = {}
    for (const option of source.selectedOptions ?? []) {
      if (option?.name && option?.value) next[option.name] = option.value
    }
    for (const option of options) {
      if (!next[option.name]) next[option.name] = option.values[0]
    }
    setSel(next)
    depthFired75Ref.current = false
    depthFired100Ref.current = false
  }, [firstVariant, options, handle])

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null
    const found = variants.find((variant) =>
      (variant?.selectedOptions ?? []).every((option: any) => String(sel[option.name]) === String(option.value)),
    )
    return found ?? firstVariant ?? null
  }, [variants, sel, firstVariant])

  const images = useMemo(() => {
    const list: string[] = []
    const variantImage = (selectedVariant as any)?.image?.url
    if (typeof variantImage === "string") list.push(variantImage)
    const mediaNodes = (product as any)?.media?.nodes ?? []
    for (const node of mediaNodes) {
      const uri = node?.image?.url
      if (typeof uri === "string") list.push(uri)
    }
    const featured = (product as any)?.featuredImage?.url
    if (typeof featured === "string") list.push(featured)
    return Array.from(new Set(list)).slice(0, 8)
  }, [product, selectedVariant])

  const trackingTags = useMemo(() => {
    const baseTags = (((product as any)?.tags as string[] | undefined) ?? [])
      .map((entry) =>
        String(entry ?? "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean)
    const mediaAltTexts = ((product as any)?.media?.nodes ?? [])
      .map((node: any) => node?.image?.altText)
      .filter(Boolean)
    const extracted = extractForYouContentSignals({
      descriptionHtml: (product as any)?.descriptionHtml ?? null,
      description: (product as any)?.description ?? null,
      imageAltTexts: mediaAltTexts,
      handle: (product as any)?.handle ?? handle,
      title: (product as any)?.title ?? null,
      vendor: (product as any)?.vendor ?? null,
      productType: (product as any)?.productType ?? null,
    })
    return Array.from(new Set([...baseTags, ...extracted])).slice(0, 36)
  }, [product, handle])

  const price = Number(
    (selectedVariant as any)?.price?.amount ?? (product as any)?.priceRange?.minVariantPrice?.amount ?? 0,
  )
  const compareAtRaw = Number((selectedVariant as any)?.compareAtPrice?.amount ?? 0)
  const compareAt = compareAtRaw > price ? compareAtRaw : undefined
  const currency =
    (selectedVariant as any)?.price?.currencyCode ??
    (product as any)?.priceRange?.minVariantPrice?.currencyCode ??
    "USD"
  const available = selectedVariant?.availableForSale !== false

  const imageHeight = Math.max(440, Math.min(cardWidth, Math.floor(itemHeight * 0.88)))
  const variantsPanelMaxHeight = Math.max(84, Math.min(168, Math.floor(itemHeight * 0.08)))

  return (
    <View className="px-[10px] pb-2" style={{ height: itemHeight }}>
      <View className="flex-1 overflow-hidden rounded-[20px] border border-[#e2e8f0] bg-white">
        {isLoading ? (
          <View className="flex-1 px-4 pt-4">
            <View className="w-full rounded-2xl bg-neutral-200" style={{ height: imageHeight }} />
            <View className="mt-4 h-5 w-2/3 rounded bg-neutral-200" />
          </View>
        ) : (
          <>
            <ImageCarousel images={images.length ? images : [""]} height={imageHeight} className="bg-[#f8fafc]" />

            <View className="flex-1 px-4 pb-4 pt-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-[15px] font-geist-semibold text-primary" numberOfLines={2}>
                  {(product as any)?.title}
                </Text>
                {__DEV__ && debugReason ? (
                  <PressableOverlay
                    onPress={() => setShowDebug((prev) => !prev)}
                    className="rounded-md bg-slate-100 px-2 py-1"
                  >
                    <Text className="text-[10px] font-semibold text-slate-600">Why</Text>
                  </PressableOverlay>
                ) : null}
              </View>
              <Text className="mt-1 text-[12px] text-secondary" numberOfLines={1}>
                {(product as any)?.vendor}
              </Text>

              {__DEV__ && showDebug && debugReason ? (
                <View className="mt-2 rounded-lg bg-slate-100 px-2 py-2">
                  <Text className="text-[11px] text-slate-700">{debugReason}</Text>
                </View>
              ) : null}

              {options.length ? (
                <View className="mt-2.5" style={{ maxHeight: variantsPanelMaxHeight }}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    bounces={false}
                    contentContainerStyle={{ paddingBottom: 2 }}
                    onScroll={(event) => {
                      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
                      const denominator = Math.max(1, contentSize.height)
                      const ratio = (contentOffset.y + layoutMeasurement.height) / denominator
                      if (ratio >= 0.75 && !depthFired75Ref.current) {
                        depthFired75Ref.current = true
                        trackForYouEvent({
                          type: "pdp_scroll_75_percent",
                          handle: (product as any)?.handle ?? handle,
                          vendor: (product as any)?.vendor ?? null,
                          productType: (product as any)?.productType ?? null,
                          tags: trackingTags.length ? trackingTags : null,
                        })
                      }
                      if (ratio >= 0.99 && !depthFired100Ref.current) {
                        depthFired100Ref.current = true
                        trackForYouEvent({
                          type: "pdp_scroll_100_percent",
                          handle: (product as any)?.handle ?? handle,
                          vendor: (product as any)?.vendor ?? null,
                          productType: (product as any)?.productType ?? null,
                          tags: trackingTags.length ? trackingTags : null,
                        })
                      }
                    }}
                    scrollEventThrottle={80}
                  >
                    <View className="flex-row flex-wrap justify-between">
                      {options.map((option) => {
                        return (
                          <View key={`${handle}-${option.name}`} className="mb-2 w-[48%]">
                            <NativeVariantSelect
                              label={option.name}
                              value={sel[option.name]}
                              options={option.values}
                              onChange={(id) => {
                                setSel((prev) => ({ ...prev, [option.name]: id }))
                                trackForYouEvent({
                                  type: "variant_select",
                                  handle: (product as any)?.handle ?? handle,
                                  vendor: (product as any)?.vendor ?? null,
                                  productType: (product as any)?.productType ?? null,
                                  tags: trackingTags.length ? trackingTags : null,
                                })
                              }}
                            />
                          </View>
                        )
                      })}
                    </View>
                  </ScrollView>
                </View>
              ) : null}

              <View className="mt-auto">
                <AddToCart
                  price={price}
                  compareAt={compareAt}
                  currency={currency}
                  available={available}
                  className="border-0"
                  loading={ensure.isPending || add.isPending}
                  onAdd={async () => {
                    try {
                      if (!selectedVariant?.id) throw new Error("Please select a variant")
                      if (!ensure.isSuccess && !ensure.isPending) await ensure.mutateAsync()
                      await add.mutateAsync({
                        merchandiseId: String(selectedVariant.id),
                        quantity: 1,
                        tracking: {
                          handle: (product as any)?.handle ?? handle,
                          vendor: (product as any)?.vendor ?? null,
                          productType: (product as any)?.productType ?? null,
                          tags: trackingTags.length ? trackingTags : null,
                        },
                      })
                    } catch (err: any) {
                      onError({ title: err?.message || "Failed to add to cart", type: "danger" })
                    }
                  }}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

function NativeVariantSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value?: string
  options: string[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selected = value && options.includes(value) ? value : (options[0] ?? "")

  useEffect(() => {
    if (!open) return
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    backdropOpacity.setValue(0)
    const frame = requestAnimationFrame(() => {
      Animated.timing(backdropOpacity, {
        toValue: 0.25,
        duration: 180,
        useNativeDriver: true,
      }).start()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, backdropOpacity])

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    },
    [],
  )

  const openPicker = () => {
    if (open) return
    setOpen(true)
  }

  const closePicker = () => {
    if (!open) return
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start()
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, 130)
  }

  return (
    <>
      <View>
        <Text className="mb-1 text-[12px] font-semibold text-slate-700">{label}</Text>
        <PressableOverlay
          onPress={openPicker}
          className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-2.5 justify-center"
        >
          <Text numberOfLines={1} className="text-[13px] text-slate-900">
            {selected || "Select"}
          </Text>
        </PressableOverlay>
      </View>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={closePicker}>
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0" onPress={closePicker}>
            <Animated.View
              pointerEvents="none"
              className="absolute inset-0 bg-transparent"
              style={{ opacity: backdropOpacity }}
            />
          </Pressable>
          <View className="rounded-t-2xl border border-slate-200 bg-white px-4 pb-6 pt-3">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[15px] font-bold text-slate-900">{label}</Text>
              <PressableOverlay onPress={closePicker} className="rounded-full px-2 py-1">
                <Text className="text-[14px] font-semibold text-slate-500">Close</Text>
              </PressableOverlay>
            </View>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator bounces={false}>
              <View className="gap-2 pb-2">
                {options.map((entry) => {
                  const isActive = entry === selected
                  return (
                    <PressableOverlay
                      key={`${label}-${entry}`}
                      onPress={() => {
                        onChange(entry)
                        closePicker()
                      }}
                      className={`rounded-xl border px-3 py-3 ${isActive ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"}`}
                    >
                      <Text className={`text-[14px] ${isActive ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                        {entry}
                      </Text>
                    </PressableOverlay>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

function normalize(value?: string | null): string {
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase()
}
