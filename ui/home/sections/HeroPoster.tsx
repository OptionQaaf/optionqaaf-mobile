import { Pressable, Text as RNText, View, useWindowDimensions, StyleSheet, PixelRatio } from "react-native"
import { Image } from "expo-image"
import { optimizeImageUrl, DEFAULT_PLACEHOLDER } from "@/lib/images/optimize"
import type { SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"

type Props = {
  title?: string
  image?: { url: string }
  onPress?: () => void
  theme?: "light" | "dark" | string
  size?: SectionSize
}

export function HeroPoster({ title, image, onPress, theme = "light", size }: Props) {
  const light = theme === "light"
  const { width } = useWindowDimensions()
  const scale = sizeScale(size)
  const posterHeight = Math.round(360 * scale)
  const titleSize = Math.round(Math.min(88, Math.max(40, width * 0.16 * scale)))
  const line = Math.round(titleSize * 1.05)
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const src =
    optimizeImageUrl(image?.url, { width: Math.round(width), height: posterHeight, format: "webp", dpr }) ||
    image?.url
  return (
    <Pressable onPress={onPress} className="overflow-hidden">
      <View style={{ height: posterHeight, width: "100%" }}>
        {src ? (
          <Image
            source={{ uri: src }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={0}
            cachePolicy="disk"
            priority="high"
            placeholder={DEFAULT_PLACEHOLDER}
          />
        ) : null}
        <View className="flex-1 justify-end" style={{ padding: Math.round(16 * scale) }}>
          {title ? (
            <RNText
              className={`font-extrabold ${light ? "text-white" : "text-black"}`}
              style={{ fontSize: titleSize, lineHeight: line, maxWidth: "88%" }}
              numberOfLines={3}
            >
              {title}
            </RNText>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}
