// ui/product/ProductTile.tsx
import { Price } from "@/ui/product/Price"
import { cn } from "@/ui/utils/cva"
import { Image, Pressable, Text, View } from "react-native"

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
}: Props) {
  const radius = rounded === "3xl" ? "rounded-3xl" : rounded === "2xl" ? "rounded-2xl" : "rounded-xl"
  const pad = padding === "lg" ? "p-4" : padding === "sm" ? "p-2.5" : "p-3"

  return (
    <Pressable onPress={onPress} className={cn(className)} style={width ? { width } : undefined}>
      <View className={cn("bg-surface border border-border overflow-hidden", radius)}>
        <View style={{ aspectRatio: 1, overflow: "hidden" }}>
          <Image source={{ uri: image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
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
