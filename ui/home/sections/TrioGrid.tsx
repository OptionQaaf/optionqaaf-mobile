import { Pressable, View, PixelRatio } from "react-native"
import { Image } from "expo-image"
import { optimizeImageUrl, DEFAULT_PLACEHOLDER } from "@/lib/images/optimize"
import type { SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"

type Cell = { image?: { url: string }; url?: string }
type Props = {
  a?: Cell
  b?: Cell
  c?: Cell
  onPressA?: () => void
  onPressB?: () => void
  onPressC?: () => void
  size?: SectionSize
}

export function TrioGrid({ a, b, c, onPressA, onPressB, onPressC, size }: Props) {
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const height = Math.max(140, Math.round(180 * sizeScale(size)))
  return (
    <View className="w-full">
      <View className="flex-row">
        <Pressable onPress={onPressA} className="flex-1">
          {!!a?.image?.url && (
            <Image
              source={{
                uri: optimizeImageUrl(a.image.url, { width: 360, height, format: "webp", dpr }) || a.image.url,
              }}
              style={{ width: "100%", height }}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
              placeholder={DEFAULT_PLACEHOLDER}
            />
          )}
        </Pressable>
        <Pressable onPress={onPressB} className="flex-1">
          {!!b?.image?.url && (
            <Image
              source={{
                uri: optimizeImageUrl(b.image.url, { width: 360, height, format: "webp", dpr }) || b.image.url,
              }}
              style={{ width: "100%", height }}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
              placeholder={DEFAULT_PLACEHOLDER}
            />
          )}
        </Pressable>
        <Pressable onPress={onPressC} className="flex-1">
          {!!c?.image?.url && (
            <Image
              source={{
                uri: optimizeImageUrl(c.image.url, { width: 360, height, format: "webp", dpr }) || c.image.url,
              }}
              style={{ width: "100%", height }}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
              placeholder={DEFAULT_PLACEHOLDER}
            />
          )}
        </Pressable>
      </View>
    </View>
  )
}
