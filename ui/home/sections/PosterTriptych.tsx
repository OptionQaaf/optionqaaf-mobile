import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { Image } from "expo-image"
import { memo } from "react"
import { PixelRatio, Pressable, Text, View } from "react-native"
import type { AlignSetting, SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"
import { parseAlign } from "./align"

type PosterItem = {
  image?: { url: string }
  url?: string
  title?: string
  subtitle?: string
  eyebrow?: string
  background?: string
  foreground?: string
  align?: AlignSetting
  layout?: string
}

type Props = {
  items?: PosterItem[]
  onPressItem?: (url: string | undefined, index: number) => void
  size?: SectionSize
}

export const PosterTriptych = memo(function PosterTriptych({ items = [], onPressItem, size }: Props) {
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const scale = sizeScale(size)

  if (!items.length) return null

  return (
    <View className="w-full">
      <View className="flex-row">
        {items.map((item, index) => {
          const background = item.background ?? "rgba(0,0,0,0.45)"
          const foreground = item.foreground ?? "#FFFFFF"
          const ratio = (() => {
            if (!item.layout) return 3 / 4
            const lower = item.layout.toLowerCase()
            if (lower.includes("wide") || lower.includes("land")) return 4 / 3
            if (lower.includes("square")) return 1
            if (lower.includes("tall") || lower.includes("portrait")) return 2 / 3
            return 3 / 4
          })()
          const alignValue = parseAlign(item.align, { horizontal: "center", vertical: "bottom" })
          const justifyClass =
            alignValue.vertical === "top"
              ? "justify-start"
              : alignValue.vertical === "center"
                ? "justify-center"
                : "justify-end"
          const alignClass =
            alignValue.horizontal === "center"
              ? "items-center"
              : alignValue.horizontal === "right"
                ? "items-end"
                : "items-start"
          const textAlign =
            alignValue.horizontal === "center" ? "center" : alignValue.horizontal === "right" ? "right" : "left"
          return (
            <Pressable
              key={index}
              onPress={() => onPressItem?.(item.url, index)}
              className="flex-1"
              accessibilityRole="button"
            >
              <View style={{ aspectRatio: ratio, minHeight: 200 * scale }} className="relative">
                {!!item.image?.url ? (
                  <Image
                    source={{
                      uri:
                        optimizeImageUrl(item.image.url, {
                          width: 420,
                          height: Math.round(420 / ratio),
                          format: "webp",
                          dpr,
                        }) || item.image.url,
                    }}
                    className="w-full h-full"
                    contentFit="cover"
                    transition={180}
                    placeholder={DEFAULT_PLACEHOLDER}
                    cachePolicy="disk"
                  />
                ) : (
                  <View className="w-full h-full" style={{ backgroundColor: item.background ?? "#121212" }} />
                )}

                <View className="absolute inset-0">
                  <View
                    className={`${justifyClass} ${alignClass}`}
                    style={{ backgroundColor: background, paddingHorizontal: 12 * scale, paddingVertical: 16 * scale }}
                  >
                    {item.eyebrow ? (
                      <Text
                        className="text-xs uppercase tracking-[3px] text-white/80"
                        numberOfLines={1}
                        style={{ fontSize: 12 * scale }}
                      >
                        {item.eyebrow}
                      </Text>
                    ) : null}
                    {item.title ? (
                      <Text
                        className="text-[20px] font-extrabold mt-1"
                        style={{ color: foreground, fontSize: 20 * scale, textAlign }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        {item.title}
                      </Text>
                    ) : null}
                    {item.subtitle ? (
                      <Text
                        className="text-sm mt-1 opacity-80"
                        style={{ color: foreground, fontSize: 14 * scale, textAlign }}
                        numberOfLines={2}
                      >
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
})
