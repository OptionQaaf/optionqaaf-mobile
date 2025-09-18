import { AppFooter } from "@/ui/layout/AppFooter"
import { Screen } from "@/ui/layout/Screen"
import { defaultKeyboardShouldPersistTaps, verticalScrollProps } from "@/ui/layout/scrollDefaults"
import { useDeferredFooter } from "@/ui/layout/useDeferredFooter"
import { useCrossfade } from "@/ui/motion/motion"
import { Button } from "@/ui/primitives/Button"
import { H1, Muted, Text } from "@/ui/primitives/Typography"
import { AddToCartBar } from "@/ui/product/AddToCartBar"
import { Price } from "@/ui/product/Price"
import { ProductTile } from "@/ui/product/ProductTile"
import { QuantityStepper } from "@/ui/product/QuantityStepper"
import { VariantDropdown } from "@/ui/product/VariantDropdown"
import { SectionHeader } from "@/ui/sections/SectionHeader"
import { useEffect, useMemo, useState } from "react"
import { FlatList, Image, useWindowDimensions, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const RECS = [
  {
    image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800",
    brand: "UNIQLO",
    title: "Utility Hoodie",
    price: 39,
    compareAt: 59,
  },
  {
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800",
    brand: "MADEXTREME",
    title: "Heavy Cotton Tee",
    price: 19,
  },
  // add more…
]

export default function PDPFlat() {
  const [size, setSize] = useState<string>()
  const [qty, setQty] = useState(1)
  const [sentinelY, setSentinelY] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const { height, width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const {
    footerVisible,
    revealFooter,
    onLayout: onListLayout,
    onContentSizeChange: onListContentSize,
  } = useDeferredFooter()

  // sticky-until with hysteresis + cross-fade
  const BAR_H = 64,
    GAP = 12
  const viewportBottom = scrollY + height - insets.bottom
  const engageStickyAt = sentinelY - BAR_H - GAP
  const disengageStickyAt = sentinelY - GAP
  const [mode, setMode] = useState<"sticky" | "inline">("sticky")
  useEffect(() => {
    if (!sentinelY) return
    if (mode === "sticky" && viewportBottom >= disengageStickyAt) setMode("inline")
    if (mode === "inline" && viewportBottom <= engageStickyAt) setMode("sticky")
  }, [viewportBottom, sentinelY, mode])

  const stickyOpacity = useSharedValue(1)
  const inlineOpacity = useSharedValue(0)
  useEffect(() => {
    stickyOpacity.value = withTiming(mode === "sticky" ? 1 : 0, { duration: 160 })
    inlineOpacity.value = withTiming(mode === "inline" ? 1 : 0, { duration: 160 })
  }, [mode])
  const aSticky = useAnimatedStyle(() => ({ opacity: stickyOpacity.value }))
  const aInline = useAnimatedStyle(() => ({ opacity: inlineOpacity.value }))

  const stickyStyle = useCrossfade(mode === "sticky")
  const inlineStyle = useCrossfade(mode === "inline")

  // grid width math (2 cols)
  const columns = 2
  const paddingH = 16
  const gap = 12
  const itemW = Math.floor((width - paddingH * 2 - gap * (columns - 1)) / columns)
  const footerNode = useMemo(() => {
    const spacer = BAR_H + insets.bottom + GAP + 24
    if (footerVisible) {
      return (
        <View style={{ paddingTop: 32 }}>
          <AppFooter />
        </View>
      )
    }
    return <View style={{ height: spacer }} />
  }, [footerVisible, BAR_H, GAP, insets.bottom])

  return (
    <Screen bleedTop bleedBottom>
      <FlatList
        {...verticalScrollProps}
        onLayout={onListLayout}
        onContentSizeChange={onListContentSize}
        data={RECS}
        keyExtractor={(_, i) => String(i)}
        numColumns={columns}
        // PDP details live in the header
        ListHeaderComponent={
          <View>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=1200" }}
              className="w-full h-[420px]"
            />
            <View className="px-6 py-4">
              <H1 className="mb-2">MAOWATCH Vintage Lapel Jacket</H1>
              <Muted className="mb-1">Color: Black</Muted>
            </View>
            <View className="px-6">
              <VariantDropdown
                label="Size"
                options={[
                  { id: "s", label: "S" },
                  { id: "m", label: "M" },
                  { id: "l", label: "L" },
                  { id: "xl", label: "XL", disabled: true },
                ]}
                value={size}
                onChange={setSize}
                className="mb-3"
              />
              <QuantityStepper value={qty} onChange={setQty} className="mb-6" />
              <Text className="mb-3">
                A durable vintage-inspired jacket with reinforced stitching and a relaxed fit.
              </Text>
            </View>

            {/* Inline CTA slot (cross-fades in) */}
            <Animated.View
              style={inlineStyle}
              className="mx-4 mt-4 rounded-3xl bg-surface border border-border px-4 py-3"
            >
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Price amount={48} compareAt={88} currency="USD" />
                </View>
                <Button size="lg" className="px-6 rounded-full">
                  Add to Cart
                </Button>
              </View>
            </Animated.View>
            {/* Spacer to reserve BAR_H so layout never jumps */}
            <View style={{ height: BAR_H }} />

            {/* Sentinel: measured ONCE, right before the recs title */}
            <View
              onLayout={(e) => {
                if (!sentinelY) setSentinelY(e.nativeEvent.layout.y)
              }}
            />

            <View className="px-6 pt-2 mb-1">
              <SectionHeader title="You might also like" />
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{ width: itemW, marginLeft: index % columns ? gap : 0, marginBottom: gap }}>
            <ProductTile {...item} width={itemW} titleLines={2} rounded="3xl" padding="md" />
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: paddingH }}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={footerNode}
        keyboardShouldPersistTaps={defaultKeyboardShouldPersistTaps}
        scrollIndicatorInsets={{ bottom: BAR_H + insets.bottom + GAP + 24 }}
        onEndReached={revealFooter}
        onEndReachedThreshold={0.1}
      />

      {/* sticky bar */}
      <Animated.View style={stickyStyle} className="absolute left-0 right-0 bottom-0">
        <AddToCartBar price={48} compareAt={88} currency="USD" onAdd={() => {}} />
      </Animated.View>
    </Screen>
  )
}
