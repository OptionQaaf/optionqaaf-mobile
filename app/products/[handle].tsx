import { useAddToCart, useEnsureCart } from "@/features/cart/api"
import { useProduct } from "@/features/pdp/api"
import { useRecommendedProducts } from "@/features/recommendations/api"
import { useSearch } from "@/features/search/api"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { ImageCarousel } from "@/ui/media/ImageCarousel"
import { Animated, MOTION, useCrossfade } from "@/ui/motion/motion"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Accordion } from "@/ui/primitives/Accordion"
import { AddToCart } from "@/ui/product/AddToCart"
import { AddToCartBar } from "@/ui/product/AddToCartBar"
import ProductDescriptionNative from "@/ui/product/ProductDescriptionNative"
import { ProductTile } from "@/ui/product/ProductTile"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { VariantDropdown } from "@/ui/product/VariantDropdown"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const h = typeof handle === "string" ? handle : ""
  const { data: product, isLoading } = useProduct(h)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const ensure = useEnsureCart()
  const add = useAddToCart()
  const { show } = useToast()

  const options: { name: string; values: string[] }[] = (product as any)?.options ?? []
  const variants: any[] = (product as any)?.variants?.nodes ?? []
  const [sel, setSel] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!options?.length) return
    setSel((prev) => {
      const next = { ...prev }
      for (const opt of options) if (!next[opt.name]) next[opt.name] = opt.values[0]
      return next
    })
  }, [product])

  const selectedVariant = useMemo(() => {
    if (!variants?.length) return null
    return (
      variants.find((v) => (v.selectedOptions ?? []).every((o: any) => String(sel[o.name]) === String(o.value))) ||
      variants[0]
    )
  }, [variants, sel])

  const available = selectedVariant?.availableForSale !== false
  const loading = ensure.isPending || add.isPending
  const [descOpen, setDescOpen] = useState<string>("")
  const [descReady, setDescReady] = useState(false)

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

  const BAR_H = 64
  const GAP = 12

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

  // Common pricing + image
  const priceAmount = Number(
    (selectedVariant as any)?.price?.amount ?? (product as any)?.priceRange?.minVariantPrice?.amount ?? 0,
  )
  const compareAtAmount = (selectedVariant as any)?.compareAtPrice?.amount
    ? Number((selectedVariant as any)?.compareAtPrice?.amount)
    : undefined
  const currencyCode = String(
    (selectedVariant as any)?.price?.currencyCode ??
      (product as any)?.priceRange?.minVariantPrice?.currencyCode ??
      "USD",
  )
  const imageForAnim =
    ((selectedVariant as any)?.image?.url as string | undefined) ||
    ((product as any)?.featuredImage?.url as string | undefined)

  if (isLoading) {
    return (
      <Screen bleedTop bleedBottom>
        <MenuBar variant="light" floating back />
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
      <MenuBar variant="light" floating back />
      <Animated.FlatList
        data={[]}
        keyExtractor={(_, i) => String(i)}
        renderItem={() => null}
        ListHeaderComponent={
          <View className="bg-white">
            <ImageCarousel
              key={images[0] ?? "pimg"}
              images={images}
              height={Math.max(600, Math.min(720, Math.round(width * 1.1)))}
            />

            <View className="px-4 py-4">
              <Text className="text-[18px] font-extrabold text-primary mb-1">{(product as any)?.title}</Text>
              <Text className="text-secondary mb-1">{(product as any)?.vendor}</Text>
              {!available ? <Text className="text-brand font-geist-semibold">Out of stock</Text> : null}
            </View>

            {/* options */}
            <View className="px-4">
              {options?.map((opt) => (
                <VariantDropdown
                  key={opt.name}
                  label={opt.name}
                  options={opt.values.map((v) => ({ id: v, label: v }))}
                  value={sel[opt.name]}
                  onChange={(id) => setSel((s) => ({ ...s, [opt.name]: id }))}
                  className="mb-3"
                />
              ))}

              {/* Description accordion: preload closed; open when ready */}
              <View className="mt-2 px-2">
                <Accordion value={descOpen} onValueChange={(v) => setDescOpen(String(v))}>
                  <Accordion.Item value="desc" title="Description" appearance="inline" keepMounted>
                    {(() => {
                      const html = (product as any)?.descriptionHtml as string | undefined
                      if (!html) return <Text className="text-secondary">No description available.</Text>
                      return (
                        <ProductDescriptionNative
                          html={html}
                          onReady={() => {
                            if (!descReady) {
                              setDescReady(true)
                              setDescOpen("desc")
                            }
                          }}
                        />
                      )
                    })()}
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
                  onAdd={async () => {
                    try {
                      if (!selectedVariant?.id) throw new Error("Please select a variant")
                      if (!ensure.isSuccess && !ensure.isPending) await ensure.mutateAsync()
                      await add.mutateAsync({ merchandiseId: String(selectedVariant.id), quantity: 1 })
                      show({ title: "Added to cart", type: "success" })
                    } catch (e: any) {
                      show({ title: e?.message || "Failed to add to cart", type: "danger" })
                    }
                  }}
                  className="mx-0"
                />
              </Animated.View>
            </View>

            <View onLayout={(e) => setSentinelY(e.nativeEvent.layout.y)} />
            <Recommended
              productId={(product as any)?.id}
              vendor={(product as any)?.vendor}
              currentHandle={(product as any)?.handle}
            />
          </View>
        }
        contentContainerStyle={{ paddingBottom: BAR_H + insets.bottom + 12 }}
        showsVerticalScrollIndicator={false}
        onScroll={(e: any) => setScrollY(e.nativeEvent.contentOffset?.y ?? 0)}
        scrollEventThrottle={16}
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
            onAdd={async () => {
              try {
                if (!selectedVariant?.id) throw new Error("Please select a variant")
                if (!ensure.isSuccess && !ensure.isPending) await ensure.mutateAsync()
                await add.mutateAsync({ merchandiseId: String(selectedVariant.id), quantity: 1 })
                show({ title: "Added to cart", type: "success" })
              } catch (e: any) {
                show({ title: e?.message || "Failed to add to cart", type: "danger" })
              }
            }}
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
}: {
  productId?: string
  vendor?: string
  currentHandle?: string
}) {
  const { data: recos } = useRecommendedProducts(productId || "")
  // Fallback to vendor-based search if Shopify returns nothing
  const q = vendor ? vendor : ""
  const { data: searchData } = useSearch(q, 12)

  const nodes = (recos && recos.length ? recos : (searchData?.pages?.flatMap((p) => p.nodes) ?? [])).filter(
    (p: any) => p?.handle !== currentHandle,
  )
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
  if (!shuffled.length) return null
  return (
    <View className="px-4 mt-4">
      <Text className="text-primary font-geist-semibold text-[18px] mb-2">You might also like</Text>
      <StaticProductGrid
        data={shuffled.slice(0, 8)}
        columns={2}
        gap={12}
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
            rounded="3xl"
            padding="md"
            onPress={() => item?.handle && router.push(`/products/${item.handle}` as any)}
          />
        )}
      />
    </View>
  )
}
