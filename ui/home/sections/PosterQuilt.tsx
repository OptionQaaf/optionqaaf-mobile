import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { Image } from "expo-image"
import { memo } from "react"
import { PixelRatio, Pressable, Text, View } from "react-native"
import type { AlignSetting, SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"
import { parseAlign } from "./align"

type QuiltItem = {
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
  items?: QuiltItem[]
  onPressItem?: (url: string | undefined, index: number) => void
  size?: SectionSize
}

const layoutRatio = (layout?: string) => {
  if (!layout) return undefined
  const lower = layout.toLowerCase()
  if (lower.includes("wide") || lower.includes("land")) return 5 / 3
  if (lower.includes("banner")) return 3 / 1
  if (lower.includes("square")) return 1
  if (lower.includes("tall") || lower.includes("portrait")) return 3 / 4
  return undefined
}

const defaultLayouts = ["portrait", "portrait", "portrait", "landscape", "statement"]

export const PosterQuilt = memo(function PosterQuilt({ items = [], onPressItem, size }: Props) {
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const scale = sizeScale(size)
  if (!items.length) return null

  const safeItems = items.slice(0, 6)

  const renderTile = (item: QuiltItem, index: number, fallbackLayout: string) => {
    const ratio = layoutRatio(item.layout) ?? layoutRatio(fallbackLayout) ?? (fallbackLayout === "statement" ? 1 : 4 / 3)
    const alignValue = parseAlign(item.align, {
      horizontal: "center",
      vertical: "bottom",
    })
    const justify =
      alignValue.vertical === "top"
        ? "justify-start"
        : alignValue.vertical === "center"
          ? "justify-center"
          : "justify-end"
    const alignItems =
      alignValue.horizontal === "center"
        ? "items-center"
        : alignValue.horizontal === "right"
          ? "items-end"
          : "items-start"
    const textAlign =
      alignValue.horizontal === "center" ? "center" : alignValue.horizontal === "right" ? "right" : "left"
    const background = item.background ?? (fallbackLayout === "statement" ? "#e11935" : "rgba(0,0,0,0.45)")
    const foreground = item.foreground ?? "#FFFFFF"

    return (
      <Pressable
        key={index}
        onPress={() => onPressItem?.(item.url, index)}
        className="flex-1"
        accessibilityRole="button"
      >
        <View style={{ aspectRatio: ratio, minHeight: 180 * scale }} className="relative overflow-hidden">
          {!!item.image?.url ? (
            <Image
              source={{
                uri:
                  optimizeImageUrl(item.image.url, {
                    width: 560,
                    height: Math.round(560 / ratio),
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
            <View className="w-full h-full" style={{ backgroundColor: background }} />
          )}

          <View className="absolute inset-0">
            <View
              className={`flex-1 ${justify} ${alignItems}`}
              style={{ paddingHorizontal: 16 * scale, paddingVertical: 16 * scale }}
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
                  className="text-[22px] font-extrabold"
                  style={{ color: foreground, fontSize: 22 * scale, textAlign }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {item.title}
                </Text>
              ) : null}
              {item.subtitle ? (
                <Text
                  className="mt-2 text-sm opacity-85"
                  style={{ color: foreground, fontSize: 14 * scale, textAlign }}
                  numberOfLines={3}
                >
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <View className="w-full">
      <View className="flex-row">
        {safeItems.slice(0, 3).map((item, index) => (
          <View key={index} className={index === 1 ? "mx-[1px] flex-1" : "flex-1"}>
            {renderTile(item, index, defaultLayouts[index] ?? "portrait")}
          </View>
        ))}
      </View>
      <View className="flex-row mt-[1px]">
        {safeItems.slice(3, 5).map((item, idx) => (
          <View key={idx + 3} className={idx === 0 ? "mr-[1px] flex-[1.2]" : "flex-[1.8]"}>
            {renderTile(item, idx + 3, defaultLayouts[idx + 3] ?? "landscape")}
          </View>
        ))}
      </View>
    </View>
  )
})
