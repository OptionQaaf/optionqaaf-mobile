import { Pressable, View, PixelRatio, Text } from "react-native"
import { Image } from "expo-image"
import { optimizeImageUrl, DEFAULT_PLACEHOLDER } from "@/lib/images/optimize"
import type { AlignSetting, SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"
import { parseAlign } from "./align"

type Item = { image?: { url: string }; url?: string; title?: string }
type Props = { left?: Item; right?: Item; onPressLeft?: () => void; onPressRight?: () => void; size?: SectionSize; align?: AlignSetting }

export function DuoPoster({ left, right, onPressLeft, onPressRight, size, align }: Props) {
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const height = Math.max(160, Math.round(220 * sizeScale(size)))
  const parsedAlign = parseAlign(align, { horizontal: "center", vertical: "bottom" })
  const justify =
    parsedAlign.vertical === "top"
      ? "justify-start"
      : parsedAlign.vertical === "center"
        ? "justify-center"
        : "justify-end"
  const alignItems =
    parsedAlign.horizontal === "center"
      ? "items-center"
      : parsedAlign.horizontal === "right"
        ? "items-end"
        : "items-start"
  const textAlign = parsedAlign.horizontal === "center" ? "center" : parsedAlign.horizontal === "right" ? "right" : "left"
  const titleSize = Math.max(14, Math.min(18, Math.round(16 * sizeScale(size))))
  return (
    <View className="w-full flex-row">
      <Pressable onPress={onPressLeft} className="flex-1">
        {!!left?.image?.url && (
          <View>
            <Image
              source={{
                uri:
                  optimizeImageUrl(left.image.url, { width: 540, height, format: "webp", dpr }) || left.image.url,
              }}
              style={{ width: "100%", height }}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
              placeholder={DEFAULT_PLACEHOLDER}
            />
            {left.title ? (
              <View className="absolute inset-0" pointerEvents="none">
                <View className={`flex-1 ${justify} ${alignItems}`} style={{ padding: 12 }}>
                  <Text
                    className="text-white font-extrabold"
                    style={{ fontSize: titleSize, textAlign }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {left.title}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
      <Pressable onPress={onPressRight} className="flex-1">
        {!!right?.image?.url && (
          <View>
            <Image
              source={{
                uri:
                  optimizeImageUrl(right.image.url, { width: 540, height, format: "webp", dpr }) || right.image.url,
              }}
              style={{ width: "100%", height }}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
              placeholder={DEFAULT_PLACEHOLDER}
            />
            {right.title ? (
              <View className="absolute inset-0" pointerEvents="none">
                <View className={`flex-1 ${justify} ${alignItems}`} style={{ padding: 12 }}>
                  <Text
                    className="text-white font-extrabold"
                    style={{ fontSize: titleSize, textAlign }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {right.title}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
    </View>
  )
}
