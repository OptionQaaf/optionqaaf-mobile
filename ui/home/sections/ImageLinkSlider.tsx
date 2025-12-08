import { Image } from "expo-image"
import { memo, useMemo } from "react"
import { type DimensionValue, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native"

import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import type { SectionSize } from "@/lib/shopify/services/home"

import { sizeScale } from "./sectionSize"

type SliderItem = {
  image?: { url?: string | null }
  url?: string
  label?: string | null
}

type Props = {
  items?: SliderItem[]
  size?: SectionSize
  onPressItem?: (url: string | undefined, index: number) => void
}

export const ImageLinkSlider = memo(function ImageLinkSlider({ items = [], size, onPressItem }: Props) {
  const slides = (items ?? []).filter((item) => item?.image?.url)
  if (!slides.length) return null

  const scale = sizeScale(size)
  const { width: windowWidth } = useWindowDimensions()
  const twoUp = slides.length === 2
  const baseWidth = 175 * scale
  const defaultTileWidth = Math.round(Math.min(320, Math.max(120, baseWidth)))
  const tileWidth = twoUp ? Math.max(defaultTileWidth, Math.round(windowWidth / 2)) : defaultTileWidth
  const tileHeight = Math.round(tileWidth * 1.2)
  const captionFontSize = Math.max(12, Math.min(18, Math.round(15 * scale)))

  if (twoUp) {
    return (
      <View className="w-full" style={{ height: tileHeight }}>
        <View style={{ flexDirection: "row", width: "100%", height: "100%" }}>
          {slides.map((item, index) => (
            <SliderTile
              key={`${item.image?.url ?? "slide"}-${index}`}
              item={item}
              width={tileWidth}
              styleWidth="50%"
              height={tileHeight}
              scale={scale}
              captionSize={captionFontSize}
              onPress={() => onPressItem?.(item.url, index)}
            />
          ))}
        </View>
      </View>
    )
  }

  return (
    <View className="w-full">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: tileHeight }}>
        {slides.map((item, index) => (
          <SliderTile
            key={`${item.image?.url ?? "slide"}-${index}`}
            item={item}
            width={tileWidth}
            height={tileHeight}
            scale={scale}
            captionSize={captionFontSize}
            onPress={() => onPressItem?.(item.url, index)}
          />
        ))}
      </ScrollView>
    </View>
  )
})

type TileProps = {
  item: SliderItem
  width: number
  height: number
  scale: number
  captionSize: number
  onPress?: () => void
  styleWidth?: number | string
}

function SliderTile({ item, width, height, scale, captionSize, onPress, styleWidth }: TileProps) {
  const uri = useMemo(
    () =>
      optimizeImageUrl(item.image?.url ?? undefined, { width, height, format: "webp", dpr: 2 }) ??
      item.image?.url ??
      undefined,
    [item.image?.url, width, height],
  )
  const paddingX = Math.max(4, Math.round(6 * scale))
  const paddingY = Math.max(2, Math.round(3 * scale))
  const bottomOffset = Math.max(8, Math.round(12 * scale))

  return (
    <Pressable
      style={{ width: (styleWidth ?? width) as DimensionValue, height, overflow: "hidden", backgroundColor: "#f3f3f3" }}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={120}
            cachePolicy="disk"
            placeholder={DEFAULT_PLACEHOLDER}
          />
        ) : (
          <View className="h-full w-full bg-neutral-200" />
        )}
      </View>

      {item.label ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: bottomOffset,
            alignItems: "center",
          }}
        >
          <View
            style={{
              backgroundColor: "transparent",
              paddingHorizontal: paddingX,
              paddingVertical: paddingY,
            }}
          >
            <Text
              style={{ fontSize: captionSize, color: "#fff", fontWeight: "900" }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.label}
            </Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  )
}
