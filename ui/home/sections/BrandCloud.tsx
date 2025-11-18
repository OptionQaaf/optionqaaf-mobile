import { useBrandIndex, useBrandPreview } from "@/features/brands/api"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { cn } from "@/ui/utils/cva"
import { Image } from "expo-image"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from "react-native"

import type { BrandSummary } from "@/lib/shopify/services/brands"
import type { SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"

type Props = {
  title?: string
  onPressBrand?: (url?: string) => void
  size?: SectionSize
}

const PLACEHOLDER = Array.from({ length: 12 })

export const BrandCloud = memo(function BrandCloud({ title, onPressBrand, size }: Props) {
  const { data, isLoading } = useBrandIndex()
  const brands = useMemo(() => {
    const source = data ?? []
    if (!source.length) return []
    const shuffled = [...source]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, 30)
  }, [data])

  const [active, setActive] = useState<BrandSummary | null>(null)

  // Tap point in **window coordinates**
  const [windowPoint, setWindowPoint] = useState<{ x: number; y: number } | null>(null)

  const { width: screenWidth } = useWindowDimensions()
  const scale = sizeScale(size)
  const verticalPadding = Math.round(20 * scale)
  const horizontalSpacing = Math.max(10, Math.round(14 * scale))
  const verticalSpacing = Math.max(6, Math.round(8 * scale))

  const { data: preview, isFetching: previewLoading } = useBrandPreview(active?.name ?? null)
  const previewImage = preview?.image?.url

  // Fade/scale animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (active && (previewImage || previewLoading)) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false, // we animate opacity+scale; keep simple
      }).start()
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: false,
      }).start()
    }
  }, [active, previewImage, previewLoading])

  const openBrand = (brand: BrandSummary) => {
    const target = brand.url
    if (!target) return
    if (target.startsWith("http")) {
      Linking.openURL(target).catch(() => {})
    } else {
      onPressBrand?.(target)
    }
    // Hide image after clicking
    clearActive()
  }

  const clearActive = () => {
    setActive(null)
    setWindowPoint(null)
  }

  // ✅ simplest: use absolute screen coords directly
  const handlePress = (brand: BrandSummary, event: GestureResponderEvent) => {
    event.stopPropagation()
    setActive(brand)
    const { pageX, pageY } = event.nativeEvent
    setWindowPoint({ x: pageX, y: pageY })
  }

  // Overlay geometry (in window space)
  const previewSize = Math.round(Math.max(160, Math.min(260, screenWidth * 0.35)))
  const previewWidth = previewSize
  const previewHeight = previewSize
  const baseX = windowPoint?.x ?? screenWidth / 2
  const baseY = windowPoint?.y ?? 200
  const overlayLeft = baseX - previewWidth / 2
  const overlayTop = baseY - previewHeight / 2
  const showPreview = !!(active && windowPoint && (previewImage || previewLoading))

  if (isLoading) {
    return (
      <View className="w-full bg-white px-4" style={{ paddingVertical: verticalPadding }}>
        {title ? <Skeleton className="mb-6 h-4 w-36" /> : null}
        <View className="flex-row flex-wrap justify-center">
          {PLACEHOLDER.map((_, idx) => (
            <Skeleton
              key={`brand-cloud-placeholder-${idx}`}
              style={{
                width: 72,
                height: 14,
                marginHorizontal: horizontalSpacing,
                marginVertical: verticalSpacing,
              }}
              className="rounded-sm"
            />
          ))}
        </View>
      </View>
    )
  }

  if (!brands.length) return null

  return (
    <>
      <View
        className="w-full bg-white px-4"
        style={{
          paddingVertical: verticalPadding,
        }}
      >
        {title ? (
          <Text className="mb-6 text-xs uppercase tracking-[4px] text-neutral-500" style={{ fontSize: 12 * scale }}>
            {title}
          </Text>
        ) : null}

        <View className="flex-row flex-wrap justify-center gap-4">
          {brands.map((brand) => {
            const isActive = active?.name === brand.name
            return (
              <Pressable
                key={brand.name}
                hitSlop={8}
                onPress={(e) => handlePress(brand, e)}
                style={({ pressed }) => [
                  {
                    marginHorizontal: horizontalSpacing,
                    marginVertical: verticalSpacing,
                  },
                  pressed ? { opacity: 0.5 } : null,
                ]}
              >
                <Text
                  className={cn("text-sm font-semibold tracking-wide", isActive ? "text-black" : "text-neutral-400")}
                  style={{ fontSize: 14 * scale }}
                >
                  {brand.name}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* 🪟 Window-level overlay: exact placement at tap point */}
      <Modal transparent visible={!!windowPoint} onRequestClose={clearActive} animationType="none">
        {/* Fullscreen touch catcher so a tap outside closes the preview */}
        <Pressable style={{ flex: 1 }} onPress={clearActive}>
          {/* 🔴 Debug dot (in window coords) */}
          {/* {windowPoint ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: baseX - 4,
                top: baseY - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "red",
                zIndex: 10000,
              }}
            />
          ) : null} */}

          {showPreview ? (
            <Animated.View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: overlayLeft,
                top: overlayTop,
                width: previewWidth,
                height: previewHeight,
                borderRadius: 32,
                overflow: "hidden",
                borderWidth: 2,
                borderColor: "#fff",
                backgroundColor: "#f2f2f2",
                opacity: fadeAnim,
                transform: [
                  {
                    scale: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              }}
            >
              <Pressable onPress={() => active && openBrand(active)} style={{ flex: 1 }}>
                {previewImage ? (
                  <Image source={{ uri: previewImage }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <Skeleton className="h-full w-full" />
                )}
              </Pressable>
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  )
})
