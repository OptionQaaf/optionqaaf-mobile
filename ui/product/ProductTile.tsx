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
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
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
  rounded = "none",
  padding = "md",
  imageRatio = 1,
  variant = "card",
  priority,
}: Props) {
  const radiusMap: Record<NonNullable<Props["rounded"]>, string> = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    "3xl": "rounded-3xl",
  }
  const radius = radiusMap[rounded] ?? radiusMap.none
  const pad = padding === "lg" ? "p-4" : padding === "sm" ? "p-2.5" : "p-3"
  const cardChrome = variant === "card" ? "bg-surface" : ""
  const targetW = width ? Math.round(width) : undefined
  const targetH = targetW ? Math.round(targetW * imageRatio) : undefined
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const src = optimizeImageUrl(image, { width: targetW, height: targetH, format: "webp", dpr }) || image
  const titleLineHeight = 20

  return (
    <Pressable
      onPress={onPress}
      className={cn("active:opacity-95", className)}
      style={width ? { width } : undefined}
    >
      <View className={cn(cardChrome, "overflow-hidden", radius)}>
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
          <Text className="text-secondary text-[11px] uppercase tracking-[0.08em] font-medium" numberOfLines={1}>
            {brand}
          </Text>
          <View style={{ minHeight: titleLineHeight * titleLines, justifyContent: "flex-start" }}>
            <Text
              className="text-primary text-[15px] font-semibold"
              style={{ lineHeight: titleLineHeight }}
              numberOfLines={titleLines}
            >
              {title}
            </Text>
          </View>
          <Price amount={price} compareAt={compareAt} currency={currency} />
        </View>
      </View>
    </Pressable>
  )
}
