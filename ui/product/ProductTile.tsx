// ui/product/ProductTile.tsx
import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { Price, type PriceSize } from "@/ui/product/Price"
import { cn } from "@/ui/utils/cva"
import { Image } from "expo-image"
import { PixelRatio, Pressable, Text, View } from "react-native"

type Props = {
  image: string
  brand: string
  title: string
  titleLines?: number
  price: number
  compareAt?: number
  currency?: string
  onPress?: () => void
  className?: string
  width?: number
  padding?: "sm" | "md" | "lg"
  imageRatio?: number
  variant?: "card" | "plain"
  priority?: "low" | "normal" | "high"
}

export function ProductTile({
  image,
  brand,
  title,
  titleLines = 1,
  price,
  compareAt,
  currency = "USD",
  onPress,
  className,
  width,
  padding = "md",
  imageRatio = 1,
  variant = "card",
  priority,
}: Props) {
  const pad = padding === "lg" ? "p-4" : padding === "sm" ? "p-2.5" : "p-3"
  const cardChrome = variant === "card" ? "bg-surface" : ""
  const targetW = width ? Math.round(width) : undefined
  const targetH = targetW ? Math.round(targetW * imageRatio) : undefined
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const src = optimizeImageUrl(image, { width: targetW, height: targetH, format: "webp", dpr }) || image
  const titleLineHeight = 20
  const priceSize: PriceSize = (() => {
    if (typeof targetW !== "number") {
      if (padding === "lg") return "md"
      if (padding === "sm") return "xs"
      return "sm"
    }
    if (targetW >= 260) return "lg"
    if (targetW >= 210) return "md"
    if (targetW >= 170) return "sm"
    return "xs"
  })()

  return (
    <Pressable
      onPress={onPress}
      className={cn("active:opacity-95 rounded-md overflow-hidden border-gray-200 border", className)}
      style={width ? { width } : undefined}
    >
      <View className={cn(cardChrome, "overflow-hidden")}>
        <View style={{ aspectRatio: imageRatio, backgroundColor: "#F5F5F7", overflow: "hidden" }}>
          <Image
            source={{ uri: src }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={priority === "high" ? 0 : 150}
            cachePolicy="disk"
            priority={priority ?? (width && width > 0 ? "normal" : "low")}
            placeholder={DEFAULT_PLACEHOLDER}
          />
        </View>

        <View className={cn(pad, "gap-2")}>
          <View style={{ minHeight: titleLineHeight * titleLines, justifyContent: "flex-start" }}>
            <Text
              className="text-primary text-[12px] font-semibold"
              style={{ lineHeight: titleLineHeight }}
              numberOfLines={titleLines}
            >
              {title}
            </Text>
          </View>
          <Price amount={price} compareAt={compareAt} currency={currency} size={priceSize} />
        </View>
      </View>
    </Pressable>
  )
}
