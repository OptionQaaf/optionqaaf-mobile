import { useProduct } from "@/features/pdp/api"
import { useSearch } from "@/features/search/api"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { ImageCarousel } from "@/ui/media/ImageCarousel"
import { MenuBar } from "@/ui/nav/MenuBar"
import { AddToCartBar } from "@/ui/product/AddToCartBar"
import { Price } from "@/ui/product/Price"
import { ProductTile } from "@/ui/product/ProductTile"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { VariantDropdown } from "@/ui/product/VariantDropdown"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, FlatList, Text, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const h = typeof handle === "string" ? handle : ""
  const { data: product, isLoading } = useProduct(h)
  const insets = useSafeAreaInsets()
  const { height, width } = useWindowDimensions()

  // images: prefer selected variant image, then product media, then featured

  // options + variants
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

  // price
  const price = Number(selectedVariant?.price?.amount ?? 0)
  const compareAt = Number(selectedVariant?.compareAtPrice?.amount ?? 0)
  const currency = String(selectedVariant?.price?.currencyCode ?? "USD")
  const available = selectedVariant?.availableForSale !== false

  // qty

  // sticky cross-fade similar to demo
  const BAR_H = 64,
    GAP = 12
  const [sentinelY, setSentinelY] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const viewportBottom = scrollY + height - insets.bottom
  const engageStickyAt = sentinelY - BAR_H - GAP
  const disengageStickyAt = sentinelY - GAP
  const [mode, setMode] = useState<"sticky" | "inline">("sticky")
  useEffect(() => {
    if (!sentinelY) return
    if (mode === "sticky" && viewportBottom >= disengageStickyAt) setMode("inline")
    if (mode === "inline" && viewportBottom <= engageStickyAt) setMode("sticky")
  }, [viewportBottom, sentinelY, mode])

  const stickyOpacity = useRef(new Animated.Value(1)).current
  const inlineOpacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(stickyOpacity, { toValue: mode === "sticky" ? 1 : 0, duration: 160, useNativeDriver: true }).start()
    Animated.timing(inlineOpacity, { toValue: mode === "inline" ? 1 : 0, duration: 160, useNativeDriver: true }).start()
  }, [mode])

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
    // de-duplicate while preserving order
    const seen = new Set<string>()
    const list: string[] = []
    for (const u of urls)
      if (u && !seen.has(u)) {
        seen.add(u)
        list.push(u)
      }
    return list.length ? list : ["https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=1200"]
  }, [product, selectedVariant])

  // loading state
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

  // description (prefer HTML fallback if plain description missing)
  const stripHtml = (html: string) =>
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  const description: string | undefined =
    ((product as any)?.description as string | undefined) ||
    ((product as any)?.descriptionHtml ? stripHtml(String((product as any).descriptionHtml)) : undefined)

  return (
    <Screen bleedTop bleedBottom>
      <MenuBar variant="light" floating back />
      <FlatList
        renderItem={() => null}
        keyExtractor={(_, i) => String(i)}
        data={[]}
        ListHeaderComponent={
          <View>
            <ImageCarousel
              key={images[0] ?? "pimg"}
              images={images}
              height={Math.max(360, Math.min(520, Math.round(width * 1.1)))}
            />
            <View className="px-4 py-4">
              <Text className="text-[28px] font-extrabold text-primary mb-1">{(product as any)?.title}</Text>
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
              {description ? <Text className="text-primary mb-4">{description}</Text> : null}
              <View className="flex-row w-full items-center justify-between mb-4">
                {/* <PressableOverlay className="px-3 py-2 rounded-full bg-neutral-100">
                  <Text className="text-primary font-geist-semibold">Size Guide</Text>
                </PressableOverlay> */}
                {/* <PressableOverlay className="px-3 py-2 rounded-full bg-neutral-100">
                  <Text className="text-primary font-geist-semibold">Shipping & Returns</Text>
                </PressableOverlay>
                <PressableOverlay className="px-3 py-2 rounded-full bg-neutral-100">
                  <Text className="text-primary font-geist-semibold">Delivery</Text>
                </PressableOverlay> */}
              </View>
            </View>

            {/* Inline CTA (crossfades in when scrolled) */}
            <Animated.View
              style={{ opacity: inlineOpacity }}
              className="mx-4 mt-2 rounded-3xl bg-surface border border-border px-4 py-3"
            >
              <View className="items-center flex-row flex-wrap gap-2">
                <View className="flex-1 min-w-0">
                  <Price
                    amount={price}
                    compareAt={compareAt > price ? compareAt : undefined}
                    currency={currency}
                    amountClassName="text-[22px] text-black"
                  />
                </View>
                <PressableOverlay
                  onPress={() => {
                    // placeholder: wire to cart later
                    // eslint-disable-next-line no-console
                    console.log("add_to_cart", { handle: h, variantId: selectedVariant?.id, qty: 1 })
                  }}
                  disabled={!available}
                  className={`px-5 py-3 rounded-full items-center ${available ? "bg-brand" : "bg-neutral-300"}`}
                >
                  <Text className="text-white font-bold text-[16px]">Add to Cart</Text>
                </PressableOverlay>
              </View>
            </Animated.View>
            {/* removed spacer to reduce unused visual gap; paddingBottom at list keeps space for sticky bar */}

            {/* sentinel before related section */}
            <View onLayout={(e) => !sentinelY && setSentinelY(e.nativeEvent.layout.y)} />

            {/* Recommended products */}
            <Recommended vendor={(product as any)?.vendor} currentHandle={(product as any)?.handle} />
          </View>
        }
        contentContainerStyle={{ paddingBottom: BAR_H + insets.bottom + 12 }}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      {/* sticky add-to-cart bar */}
      <Animated.View style={{ opacity: stickyOpacity }} className="absolute left-0 right-0 bottom-0">
        <AddToCartBar
          price={price}
          compareAt={compareAt > price ? compareAt : undefined}
          currency={currency}
          available={available}
          onAdd={() => {
            // placeholder: cart wiring will be added later
            // eslint-disable-next-line no-console
            console.log("add_to_cart", { handle: h, variantId: selectedVariant?.id, qty: 1 })
          }}
        />
      </Animated.View>
    </Screen>
  )
}

function Recommended({ vendor, currentHandle }: { vendor?: string; currentHandle?: string }) {
  const q = vendor ? vendor : ""
  const { data } = useSearch(q, 12)
  const nodes = (data?.pages?.flatMap((p) => p.nodes) ?? []).filter(
    (p: any) => p?.vendor === vendor && p?.handle !== currentHandle,
  )
  if (!nodes.length) return null
  return (
    <View className="px-4 mt-4">
      <Text className="text-primary font-geist-semibold text-[18px] mb-2">You might also like</Text>
      <StaticProductGrid
        data={nodes.slice(0, 8)}
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
