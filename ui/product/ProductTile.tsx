// ui/product/ProductTile.tsx
import { Price } from "@/ui/product/Price"
import { cn } from "@/ui/utils/cva"
import { Pressable, Text, View, PixelRatio } from "react-native"
import { Image } from "expo-image"
import { optimizeImageUrl, DEFAULT_PLACEHOLDER } from "@/lib/images/optimize"

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
  rounded?: "xl" | "2xl" | "3xl"
  padding?: "sm" | "md" | "lg"
  imageRatio?: number
  variant?: "card" | "plain"
  priority?: "low" | "normal" | "high"
}

export function ProductTile({
  image,
  brand,
  title,
  titleLines = 2,
  price,
  compareAt,
  currency = "USD",
  onPress,
  className,
  width,
  rounded = "3xl",
  padding = "md",
  imageRatio = 1,
  variant = "card",
  priority,
}: Props) {
  const radius = rounded === "3xl" ? "rounded-3xl" : rounded === "2xl" ? "rounded-2xl" : "rounded-xl"
  const pad = padding === "lg" ? "p-4" : padding === "sm" ? "p-2.5" : "p-3"
  const cardChrome = variant === "card" ? "bg-surface border border-border" : ""
  const targetW = width ? Math.round(width) : undefined
  const targetH = targetW ? Math.round(targetW * imageRatio) : undefined
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const src = optimizeImageUrl(image, { width: targetW, height: targetH, format: "webp", dpr }) || image

  return (
    <Pressable onPress={onPress} className={cn(className)} style={width ? { width } : undefined}>
      <View className={cn(cardChrome, "overflow-hidden", radius)}>
        <View style={{ aspectRatio: imageRatio, overflow: "hidden" }}>
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

        <View className={cn(pad)}>
          <Text className="text-secondary text-[12px] mb-1" numberOfLines={1}>
            {brand}
          </Text>
          <Text className="text-primary mb-1" numberOfLines={titleLines}>
            {title}
          </Text>
          <Price amount={price} compareAt={compareAt} currency={currency} />
        </View>
      </View>
    </Pressable>
  )
}
