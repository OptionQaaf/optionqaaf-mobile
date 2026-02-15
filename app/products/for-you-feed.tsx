import { useAddToCart, useEnsureCart } from "@/features/cart/api"
import { extractForYouContentSignals } from "@/features/for-you/contentSignals"
import type { ForYouCandidate } from "@/features/for-you/profile"
import { trackForYouEvent } from "@/features/for-you/tracking"
import { useProduct } from "@/features/pdp/api"
import { useRecommendedProducts } from "@/features/recommendations/api"
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
const MAX_RECOMMENDED_SEEDS = 18

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
  const seedProductId =
    typeof seedItem?.id === "string" && seedItem.id.startsWith("gid://shopify/Product/") ? seedItem.id : ""
  const recommendationsQuery = useRecommendedProducts({
    productId: seedProductId || null,
    productHandle: seedItem?.handle ?? null,
    intent: "RELATED",
  })

  const feedItems = useMemo(() => {
    if (!seedItem) return [] as ForYouCandidate[]

    const recommended = ((recommendationsQuery.data ?? []) as any[])
      .map<ForYouCandidate>((item) => ({
        id: String(item?.id ?? item?.handle ?? ""),
        handle: String(item?.handle ?? ""),
        title: typeof item?.title === "string" ? item.title : null,
        vendor: typeof item?.vendor === "string" ? item.vendor : null,
        productType: typeof item?.productType === "string" ? item.productType : null,
        tags: Array.isArray(item?.tags) ? (item.tags as string[]) : null,
        createdAt: typeof item?.createdAt === "string" ? item.createdAt : null,
        availableForSale: typeof item?.availableForSale === "boolean" ? item.availableForSale : null,
        featuredImage: item?.featuredImage
          ? {
              id: item.featuredImage.id ?? null,
              url: item.featuredImage.url ?? null,
              altText: item.featuredImage.altText ?? null,
              width: item.featuredImage.width ?? null,
              height: item.featuredImage.height ?? null,
            }
          : null,
        priceRange: item?.priceRange ?? null,
        compareAtPriceRange: item?.compareAtPriceRange ?? null,
      }))
      .filter((entry) => Boolean(entry.handle))
      .slice(0, MAX_RECOMMENDED_SEEDS)

    const personalizedTail = baseItems
      .filter((item) => item.handle && item.handle !== seedItem.handle)
      .map((item, index) => ({ item, score: scoreSimilarity(seedItem, item, index) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item)

    const merged = [seedItem, ...recommended, ...personalizedTail]
    const seen = new Set<string>()
    const out: ForYouCandidate[] = []
    for (const item of merged) {
      const handle = normalize(item.handle)
      if (!handle || seen.has(handle)) continue
      seen.add(handle)
      out.push(item)
    }
    return out
  }, [baseItems, recommendationsQuery.data, seedItem])

  const [activeIndex, setActiveIndex] = useState(0)
  const seenHandlesRef = useRef<Set<string>>(new Set())
  const previousSeedHandleRef = useRef<string>("")

  useEffect(() => {
    const seedHandle = seedItem?.handle ?? ""
    if (seedHandle === previousSeedHandleRef.current) return
    previousSeedHandleRef.current = seedHandle
    setActiveIndex(0)
    seenHandlesRef.current = new Set()
  }, [seedItem?.handle])

  useEffect(() => {
    const active = feedItems[activeIndex]
    if (!active?.handle) return
    if (seenHandlesRef.current.has(active.handle)) return
    seenHandlesRef.current.add(active.handle)
    trackForYouEvent({
      type: "product_open",
      handle: active.handle,
      vendor: active.vendor ?? null,
      productType: active.productType ?? null,
      tags: active.tags ?? null,
    })
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

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((token) => token.isViewable)
    if (typeof first?.index === "number") {
      setActiveIndex(first.index)
    }
  }).current

  const reelHeight = Math.max(460, Math.floor(height * REEL_HEIGHT_RATIO))
  const reelPeek = Math.max(40, height - reelHeight)
  const topOffset = insets.top + FLOATING_MENU_BAR_CONTENT_HEIGHT

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
          <FeedProductPage seed={item} itemHeight={reelHeight} cardWidth={width - 20} onError={show} />
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
        contentContainerStyle={{ paddingTop: topOffset, paddingBottom: reelPeek + 8 }}
      />
    </View>
  )
}

function FeedProductPage({
  seed,
  itemHeight,
  cardWidth,
  onError,
}: {
  seed: ForYouCandidate
  itemHeight: number
  cardWidth: number
  onError: (input: { title: string; type?: "danger" | "success" | "info" }) => void
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
  }, [firstVariant, options])

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
              <Text className="text-[15px] font-geist-semibold text-primary" numberOfLines={2}>
                {(product as any)?.title}
              </Text>
              <Text className="mt-1 text-[12px] text-secondary" numberOfLines={1}>
                {(product as any)?.vendor}
              </Text>

              {options.length ? (
                <View className="mt-2.5" style={{ maxHeight: variantsPanelMaxHeight }}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    bounces={false}
                    contentContainerStyle={{ paddingBottom: 2 }}
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
              className="absolute inset-0 bg-black"
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

function tokenize(value?: string | null): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3)
}

function scoreSimilarity(seed: ForYouCandidate, candidate: ForYouCandidate, originalIndex: number): number {
  let score = 0

  const seedVendor = normalize(seed.vendor)
  const candidateVendor = normalize(candidate.vendor)
  if (seedVendor && seedVendor === candidateVendor) score += 7

  const seedType = normalize(seed.productType)
  const candidateType = normalize(candidate.productType)
  if (seedType && seedType === candidateType) score += 4.5

  const seedTags = new Set((seed.tags ?? []).map((entry) => normalize(entry)).filter(Boolean))
  const candidateTags = (candidate.tags ?? []).map((entry) => normalize(entry)).filter(Boolean)
  let tagOverlap = 0
  for (const tag of candidateTags) {
    if (seedTags.has(tag)) tagOverlap += 1
  }
  score += Math.min(4, tagOverlap * 1.4)

  const seedTokens = new Set([...tokenize(seed.title), ...tokenize(seed.handle), ...tokenize(seed.vendor)])
  const candidateTokens = [...tokenize(candidate.title), ...tokenize(candidate.handle), ...tokenize(candidate.vendor)]
  let tokenOverlap = 0
  for (const token of candidateTokens) {
    if (seedTokens.has(token)) tokenOverlap += 1
  }
  score += Math.min(5, tokenOverlap * 0.85)

  score += Math.max(0, 1.2 - originalIndex * 0.03)
  return score
}
