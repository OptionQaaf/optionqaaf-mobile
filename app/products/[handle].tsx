import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { useAddToCart, useEnsureCart } from "@/features/cart/api"
import { useFypTrackingStore } from "@/features/fyp"
import { isPushAdmin } from "@/features/notifications/admin"
import { useProduct } from "@/features/pdp/api"
import { useRecommendedProducts } from "@/features/recommendations/api"
import { useSearch } from "@/features/search/api"
import { shareRemoteImage } from "@/src/lib/media/shareRemoteImage"
import type { WishlistItem } from "@/store/wishlist"
import { useWishlist } from "@/store/wishlist"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { AppFooter } from "@/ui/layout/AppFooter"
import { padToFullRow } from "@/ui/layout/gridUtils"
import { Screen } from "@/ui/layout/Screen"
import { defaultKeyboardShouldPersistTaps, verticalScrollProps } from "@/ui/layout/scrollDefaults"
import { useDeferredFooter } from "@/ui/layout/useDeferredFooter"
import { ImageCarousel } from "@/ui/media/ImageCarousel"
import { Animated, MOTION, useCrossfade } from "@/ui/motion/motion"
import { Accordion } from "@/ui/primitives/Accordion"
import { AddToCart } from "@/ui/product/AddToCart"
import { AddToCartBar } from "@/ui/product/AddToCartBar"
import { BrandCard } from "@/ui/product/BrandCard"
import ProductDescriptionNative from "@/ui/product/ProductDescriptionNative"
import { ProductTile } from "@/ui/product/ProductTile"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { VariantDropdown } from "@/ui/product/VariantDropdown"
import * as Clipboard from "expo-clipboard"
import { router, useLocalSearchParams } from "expo-router"
import { Copy, Download, Star } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function ProductScreen() {
  const {
    handle,
    variant: variantParam,
    code: codeParam,
  } = useLocalSearchParams<{
    handle: string
    variant?: string
    code?: string
  }>()
  const h = typeof handle === "string" ? handle : ""
  const requestedVariantId = useMemo(() => {
    if (typeof variantParam !== "string") return null
    try {
      return decodeURIComponent(variantParam)
    } catch {
      return variantParam
    }
  }, [variantParam])
  const requestedCode = useMemo(() => {
    if (typeof codeParam !== "string") return null
    try {
      return decodeURIComponent(codeParam)
    } catch {
      return codeParam
    }
  }, [codeParam])
  const { data: product, isLoading } = useProduct(h)
  const { isAuthenticated, login } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated })
  const vendor = ((product as any)?.vendor ?? "") as string
  const isAdmin = useMemo(() => isPushAdmin(profile?.email), [profile?.email])
  const { data: vendorSearchData, isLoading: isVendorLoading } = useSearch(vendor, 12)
  const vendorProducts = useMemo(() => vendorSearchData?.pages?.flatMap((p) => p.nodes) ?? [], [vendorSearchData])
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const ensure = useEnsureCart()
  const add = useAddToCart()
  const recordView = useFypTrackingStore((state) => state.recordView)
  const { show } = useToast()
  const wishlistItems = useWishlist((s) => s.items)
  const toggleWishlist = useWishlist((s) => s.toggle)

  const options = useMemo<{ name: string; values: string[] }[]>(() => (product as any)?.options ?? [], [product])
  const variants = useMemo<any[]>(() => (product as any)?.variants?.nodes ?? [], [product])
  const inStockVariants = useMemo(() => variants.filter((v) => v?.availableForSale !== false), [variants])
  const requestedVariant = useMemo(() => {
    const byId = variants.find((v) => v?.id === requestedVariantId)
    if (byId) return byId
    if (!requestedCode) return null
    const normalized = requestedCode.trim().toLowerCase()
    const condensed = normalized.replace(/\s+/g, "")
    return (
      variants.find((v) => {
        const bc = ((v as any)?.barcode ?? "").toString().toLowerCase()
        return bc === normalized || bc === condensed
      }) ?? null
    )
  }, [variants, requestedVariantId, requestedCode])
  const variantsPool = useMemo(() => {
    const base = inStockVariants.length ? inStockVariants : variants
    if (requestedVariant && !base.includes(requestedVariant)) return [...base, requestedVariant]
    return base
  }, [variants, inStockVariants, requestedVariant])
  const firstAvailableVariant = useMemo(() => variantsPool[0] ?? null, [variantsPool])
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [isSavingImage, setIsSavingImage] = useState(false)
  const [sel, setSel] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!options?.length) return
    setSel((prev) => {
      const next = { ...prev }
      const source = requestedVariant ?? firstAvailableVariant ?? variants[0]
      if (source?.selectedOptions) {
        for (const opt of source.selectedOptions) {
          if (opt?.name && opt?.value) next[opt.name] = opt.value
        }
      }
      for (const opt of options) if (!next[opt.name]) next[opt.name] = opt.values[0]
      return next
    })
  }, [product, options, firstAvailableVariant, variants, requestedVariant])

  const availableOptionValues = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const opt of options) {
      const otherSelections = { ...sel }
      delete otherSelections[opt.name]
      const values = new Set<string>()
      const pool = variantsPool.length ? variantsPool : variants
      for (const v of pool) {
        const selectedOptions = v?.selectedOptions ?? []
        const matchesOthers = Object.entries(otherSelections).every(([name, val]) =>
          selectedOptions.some((o: any) => o?.name === name && String(o?.value) === String(val)),
        )
        if (!matchesOthers) continue
        const match = selectedOptions.find((o: any) => o?.name === opt.name)
        if (match?.value) values.add(String(match.value))
      }
      const list = Array.from(values)
      map[opt.name] = list.length ? list : opt.values
    }
    return map
  }, [options, sel, variants, variantsPool])

  useEffect(() => {
    if (!options?.length) return
    if (requestedVariant) return
    setSel((prev) => {
      let changed = false
      const next = { ...prev }
      for (const opt of options) {
        const avail = availableOptionValues[opt.name] ?? opt.values
        const current = next[opt.name]
        if (!avail.includes(current) && avail.length) {
          next[opt.name] = avail[0]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [options, availableOptionValues, requestedVariant])

  const selectedVariant = useMemo(() => {
    if (!variants?.length) return null
    if (requestedVariant) return requestedVariant
    const pool = variantsPool.length ? variantsPool : variants
    const match = pool.find((v) => (v.selectedOptions ?? []).every((o: any) => String(sel[o.name]) === String(o.value)))
    return match ?? firstAvailableVariant ?? variants[0] ?? null
  }, [variants, sel, firstAvailableVariant, variantsPool, requestedVariant])

  const available = selectedVariant?.availableForSale !== false
  const loading = ensure.isPending || add.isPending

  const productTitle = useMemo(() => (product as any)?.title ?? "Product image", [product])

  const images = useMemo(() => {
    const urls: string[] = []
    const vUrl = (selectedVariant as any)?.image?.url as string | undefined
    if (vUrl) urls.push(String(vUrl))
    const mediaNodes: any[] = (product as any)?.media?.nodes ?? []
    for (const m of mediaNodes) {
      const url = (m as any)?.image?.url as string | undefined
      if (url) urls.push(String(url))
    }
    const feat = (product as any)?.featuredImage?.url as string | undefined
    if (feat) urls.push(String(feat))
    const seen = new Set<string>(),
      list: string[] = []
    for (const u of urls)
      if (u && !seen.has(u)) {
        seen.add(u)
        list.push(u)
      }
    return list.length ? list : ["https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=1200"]
  }, [product, selectedVariant])
  const currentImage = useMemo(() => images[carouselIndex] ?? images[0], [carouselIndex, images])
  const handleDownloadImage = useCallback(async () => {
    if (!currentImage || isSavingImage) return
    if (typeof FileReader === "undefined") {
      show({ title: "Unable to prepare image", type: "danger" })
      return
    }
    setIsSavingImage(true)
    try {
      await shareRemoteImage({ imageUrl: currentImage, title: productTitle })
    } catch (err: any) {
      const message = err?.message || "Could not download image"
      show({ title: message, type: "danger" })
    } finally {
      setIsSavingImage(false)
    }
  }, [currentImage, isSavingImage, productTitle, show])

  const BAR_H = 64
  const GAP = 12

  useEffect(() => {
    if (!h) return
    recordView(h)
  }, [h, recordView])

  // Inline vs sticky states with hysteresis and fade crossfade
  const [mode, setMode] = useState<"inline" | "sticky">("inline")
  const [sentinelY, setSentinelY] = useState<number>(Number.POSITIVE_INFINITY)
  const [scrollY, setScrollY] = useState(0)
  const { height } = useWindowDimensions()
  const viewportBottom = scrollY + height - insets.bottom
  const engageStickyAt = sentinelY - BAR_H - GAP
  const disengageStickyAt = sentinelY - GAP

  useEffect(() => {
    if (!Number.isFinite(sentinelY)) return
    if (mode === "inline" && viewportBottom < engageStickyAt) setMode("sticky")
    else if (mode === "sticky" && viewportBottom > disengageStickyAt) setMode("inline")
  }, [viewportBottom, engageStickyAt, disengageStickyAt, sentinelY, mode])

  const stickyStyle = useCrossfade(mode === "sticky", MOTION.dur.sm)
  const inlineStyle = useCrossfade(mode === "inline", MOTION.dur.sm)

  const inlineRef = useRef<View>(null)
  const stickyRef = useRef<View>(null)
  const {
    footerVisible,
    revealFooter,
    onLayout: onListLayout,
    onContentSizeChange: onListContentSizeChange,
  } = useDeferredFooter()
  const footerNode = useMemo(() => {
    const spacer = BAR_H + insets.bottom + 12
    if (footerVisible) {
      return (
        <View style={{ paddingTop: 32 }}>
          <AppFooter />
        </View>
      )
    }
    return <View style={{ height: spacer }} />
  }, [footerVisible, BAR_H, insets.bottom])

  // Common pricing + image
  const currencyCode = String(
    (selectedVariant as any)?.price?.currencyCode ??
      (product as any)?.priceRange?.minVariantPrice?.currencyCode ??
      "USD",
  )
  const priceAmount = Number(
    (selectedVariant as any)?.price?.amount ?? (product as any)?.priceRange?.minVariantPrice?.amount ?? 0,
  )
  const compareAtAmount = (selectedVariant as any)?.compareAtPrice?.amount
    ? Number((selectedVariant as any)?.compareAtPrice?.amount)
    : undefined
  const variantCode = ((selectedVariant as any)?.barcode as string | undefined) ?? null
  const vendorPriceRange = useMemo(() => {
    if (!vendorProducts.length) return null
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let currency = currencyCode
    for (const item of vendorProducts) {
      const amount = Number(item?.priceRange?.minVariantPrice?.amount ?? 0)
      if (!Number.isFinite(amount)) continue
      if (amount < min) min = amount
      if (amount > max) max = amount
      if (!currency && item?.priceRange?.minVariantPrice?.currencyCode) {
        currency = String(item?.priceRange?.minVariantPrice?.currencyCode)
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    return { min, max, currency }
  }, [vendorProducts, currencyCode])
  const vendorPreviewImages = useMemo(() => {
    const currentHandle = (product as any)?.handle
    const seen = new Set<string>()
    const list: string[] = []
    for (const item of vendorProducts) {
      if (currentHandle && item?.handle === currentHandle) continue
      const url = item?.featuredImage?.url
      if (typeof url !== "string" || !url.trim() || seen.has(url)) continue
      seen.add(url)
      list.push(url)
      if (list.length >= 3) break
    }
    return list
  }, [vendorProducts, product])
  const productId = (product as any)?.id as string | undefined
  const isWishlisted = isAuthenticated && productId ? wishlistItems.some((item) => item.productId === productId) : false

  const wishlistData = useMemo<WishlistItem | null>(() => {
    if (!isAuthenticated || !productId) return null
    return {
      productId,
      handle: h,
      title: (product as any)?.title ?? "",
      vendor: (product as any)?.vendor ?? null,
      price: Number.isFinite(priceAmount) ? { amount: priceAmount, currencyCode } : null,
      imageUrl: images[0] ?? null,
      variantTitle: (selectedVariant as any)?.title ?? null,
    }
  }, [productId, h, product, priceAmount, currencyCode, images, selectedVariant, isAuthenticated])

  const handleWishlistPress = useCallback(() => {
    if (!isAuthenticated) {
      show({ title: "Sign in to save items to wishlist", type: "info" })
      login().catch(() => {})
      return
    }
    if (!wishlistData) {
      show({ title: "Product unavailable", type: "danger" })
      return
    }
    toggleWishlist(wishlistData)

    show({
      title: isWishlisted ? "Removed from wishlist" : "Added to wishlist",
      type: isWishlisted ? "info" : "success",
    })
  }, [wishlistData, toggleWishlist, isWishlisted, show, isAuthenticated, login])

  const copyVariantCode = useCallback(() => {
    if (!variantCode) return
    Clipboard.setStringAsync(variantCode).catch(() => {})
    show({ title: "Barcode copied", type: "success" })
  }, [variantCode, show])

  const handleAddToCart = useCallback(async () => {
    try {
      if (!selectedVariant?.id) throw new Error("Please select a variant")
      if (!ensure.isSuccess && !ensure.isPending) await ensure.mutateAsync()
      await add.mutateAsync({
        merchandiseId: String(selectedVariant.id),
        quantity: 1,
        tracking: { handle: h },
      })
      show({ title: "Added to cart", type: "success" })
    } catch (e: any) {
      show({ title: e?.message || "Failed to add to cart", type: "danger" })
    }
  }, [add, ensure, h, selectedVariant?.id, show])

  if (isLoading) {
    return (
      <Screen bleedTop bleedBottom>
        <View className="px-4 py-6">
          <View className="w-full h-[420px] bg-neutral-200 rounded-2xl" />
          <View className="h-4" />
          <View className="h-8 w-2/3 bg-neutral-200 rounded-md" />
        </View>
      </Screen>
    )
  }

  return (
    <Screen bleedTop bleedBottom>
      <Animated.FlatList
        {...verticalScrollProps}
        onLayout={onListLayout}
        onContentSizeChange={onListContentSizeChange}
        data={[]}
        keyExtractor={(_, i) => String(i)}
        renderItem={() => null}
        ListHeaderComponent={
          <View className="bg-white">
            <View className="relative">
              <ImageCarousel
                key={images[0] ?? "pimg"}
                images={images}
                height={Math.max(600, Math.min(720, Math.round(width * 1.1)))}
                onIndexChange={setCarouselIndex}
              />
              {isAdmin ? (
                <View className="absolute right-3 bottom-3 z-10">
                  <PressableOverlay
                    accessibilityLabel="Download product image"
                    onPress={handleDownloadImage}
                    disabled={isSavingImage}
                    className="rounded-full bg-black/70 p-2 shadow-lg"
                  >
                    {isSavingImage ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Download size={20} color="#fff" strokeWidth={1.5} />
                    )}
                  </PressableOverlay>
                </View>
              ) : null}
            </View>

            <View className="px-4 py-4 flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text className="text-[14px] uppercase font-medium text-primary mb-1">{(product as any)?.title}</Text>
                <Text className="text-secondary text-xs mb-1">{(product as any)?.vendor}</Text>
                {variantCode ? (
                  <PressableOverlay
                    onPress={copyVariantCode}
                    className="self-start flex-row items-center gap-1 rounded-full bg-[#f1f5f9] px-2.5 py-1"
                  >
                    <Copy size={14} color="#0f172a" strokeWidth={1.5} />
                    <Text className="text-[12px] font-semibold text-[#0f172a]">{variantCode}</Text>
                  </PressableOverlay>
                ) : null}
                {!available ? <Text className="text-brand font-geist-semibold">Out of stock</Text> : null}
              </View>
              {wishlistData ? (
                <PressableOverlay
                  accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  onPress={handleWishlistPress}
                  className="h-10 w-10 rounded-3xl bg-[#f1f5f9] items-center justify-center"
                >
                  <Star
                    size={22}
                    color={isWishlisted ? "#f59e0b" : "#1f2937"}
                    fill={isWishlisted ? "#f59e0b" : "transparent"}
                    strokeWidth={1.5}
                  />
                </PressableOverlay>
              ) : null}
            </View>

            {/* options */}
            <View className="px-4">
              {options?.map((opt) => (
                <VariantDropdown
                  key={opt.name}
                  label={opt.name}
                  options={(availableOptionValues[opt.name] ?? opt.values).map((v) => ({ id: v, label: v }))}
                  value={sel[opt.name]}
                  onChange={(id) => {
                    setSel((s) => ({ ...s, [opt.name]: id }))
                  }}
                  className="mb-3"
                />
              ))}

              {vendor ? (
                <View className="my-2">
                  <BrandCard
                    name={vendor}
                    productCount={vendorProducts.length}
                    images={vendorPreviewImages}
                    priceRange={vendorPriceRange}
                    loading={isVendorLoading && !vendorProducts.length}
                    onPress={() =>
                      router.push({ pathname: "/collections/[handle]", params: { handle: "vendors", q: vendor } })
                    }
                  />
                </View>
              ) : null}

              {/* Description accordion: preload closed; open when ready */}
              <View className="mt-2 px-2">
                <Accordion defaultValue="desc" /* don’t control it unless needed */>
                  <Accordion.Item value="desc" title="Description" appearance="inline" keepMounted>
                    <ProductDescriptionNative
                      html={(product as any)?.descriptionHtml}
                      isAdmin={isAdmin}
                      productTitle={productTitle}
                    />
                  </Accordion.Item>
                </Accordion>
              </View>

              {/* Inline Add to Cart (pill) */}
              <Animated.View style={inlineStyle} className="mt-2">
                <AddToCart
                  ref={inlineRef}
                  price={priceAmount}
                  compareAt={compareAtAmount}
                  currency={currencyCode}
                  available={available}
                  loading={loading}
                  onAdd={handleAddToCart}
                  className="mx-0"
                />
              </Animated.View>
            </View>

            <View onLayout={(e) => setSentinelY(e.nativeEvent.layout.y)} />
            <Recommended
              productId={(product as any)?.id}
              vendor={(product as any)?.vendor}
              currentHandle={(product as any)?.handle}
              vendorFallback={vendorProducts}
            />
          </View>
        }
        contentContainerStyle={{ paddingBottom: 0 }}
        ListFooterComponent={footerNode}
        keyboardShouldPersistTaps={defaultKeyboardShouldPersistTaps}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ bottom: BAR_H + insets.bottom + 12 }}
        onScroll={(e: any) => {
          const offsetY = e.nativeEvent.contentOffset?.y ?? 0
          setScrollY(offsetY)
        }}
        scrollEventThrottle={16}
        onEndReached={revealFooter}
        onEndReachedThreshold={0.1}
      />

      {/* Sticky Add to Cart (cross-fades with inline) */}
      {product ? (
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, stickyStyle]} className="z-20">
          <AddToCartBar
            ref={stickyRef}
            price={priceAmount}
            compareAt={compareAtAmount}
            currency={currencyCode}
            available={available}
            loading={loading}
            onAdd={handleAddToCart}
          />
        </Animated.View>
      ) : null}
    </Screen>
  )
}

function Recommended({
  productId,
  vendor,
  currentHandle,
  vendorFallback,
}: {
  productId?: string
  vendor?: string
  currentHandle?: string
  vendorFallback?: any[]
}) {
  const { data: recos } = useRecommendedProducts({ productId: productId || null })
  // Fallback to vendor-based search if Shopify returns nothing
  const fallback = vendorFallback ?? []
  const baseNodes = recos && recos.length ? recos : fallback
  const nodes = baseNodes.filter((p: any) => p?.handle !== currentHandle)
  // Deterministic shuffle per product (stable across re-renders)
  const shuffled = useMemo(() => {
    const seedStr = String(productId || currentHandle || "seed")
    let seed = 0
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0
    const rng = (function mulberry32(a: number) {
      return () => {
        let t = (a += 0x6d2b79f5)
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    })(seed)
    const arr = [...nodes]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [nodes, productId, currentHandle])
  const gridRecs = useMemo(() => padToFullRow(shuffled.slice(0, 8), 2), [shuffled])
  if (!shuffled.length) return null
  return (
    <View className="px-4 mt-4">
      <Text className="text-primary font-geist-semibold text-[18px] mb-2">You might also like</Text>
      <StaticProductGrid
        data={gridRecs}
        columns={2}
        gap={8}
        renderItem={(item: any, w: number) => (
          <ProductTile
            image={item?.featuredImage?.url ?? ""}
            brand={item?.vendor ?? ""}
            title={item?.title ?? ""}
            price={Number(item?.priceRange?.minVariantPrice?.amount ?? 0)}
            compareAt={undefined}
            currency={(item?.priceRange?.minVariantPrice?.currencyCode as any) ?? "USD"}
            width={w}
            imageRatio={3 / 4}
            padding="sm"
            onPress={() => item?.handle && router.push(`/products/${item.handle}` as any)}
          />
        )}
      />
    </View>
  )
}
