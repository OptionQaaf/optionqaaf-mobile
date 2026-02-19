// ui/product/ProductTile.tsx
import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { ProductTileCarousel } from "@/ui/product/ProductTileCarousel"
import { Price, type PriceSize } from "@/ui/product/Price"
import { useTapOrSwipe } from "@/ui/product/useTapOrSwipe"
import { cn } from "@/ui/utils/cva"
import { Image } from "expo-image"
import { useMemo } from "react"
import { PixelRatio, Text, View } from "react-native"
import { GestureDetector } from "react-native-gesture-handler"

type PaddingSize = "xs" | "sm" | "md" | "lg"

type Props = {
  image: string
  images?: string[]
  brand: string
  title: string
  titleLines?: number
  price: number
  compareAt?: number
  currency?: string
  onPress?: () => void
  className?: string
  width?: number
  padding?: PaddingSize
  imageRatio?: number
  variant?: "card" | "plain"
  priority?: "low" | "normal" | "high"
  edgeToEdge?: boolean
}

const TILE_PRICE_SIZE_OVERRIDES: Record<
  PriceSize,
  {
    amount: string
    compare: string
    discount: string
  }
> = {
  xs: {
    amount: "text-[10px]",
    compare: "text-[8px]",
    discount: "text-[9px]",
  },
  sm: {
    amount: "text-[12px]",
    compare: "text-[10px]",
    discount: "text-[10px]",
  },
  md: {
    amount: "text-[14px]",
    compare: "text-[11px]",
    discount: "text-[11px]",
  },
  lg: {
    amount: "text-[16px]",
    compare: "text-[12px]",
    discount: "text-[12px]",
  },
  xl: {
    amount: "text-[18px]",
    compare: "text-[13px]",
    discount: "text-[13px]",
  },
}

export function ProductTile({
  image,
  images,
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
  edgeToEdge = false,
}: Props) {
  const resolvedPadding: PaddingSize = (() => {
    if (edgeToEdge && padding === "md") return "sm"
    return padding
  })()
  const padMap: Record<PaddingSize, string> = {
    lg: "p-4",
    md: "p-3",
    sm: "p-2.5",
    xs: "p-2",
  }
  const pad = padMap[resolvedPadding]
  const cardChrome = variant === "card" && !edgeToEdge ? "bg-surface" : ""
  const targetW = width ? Math.round(width) : undefined
  const targetH = targetW ? Math.round(targetW * imageRatio) : undefined
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const tileImages = useMemo(() => {
    const urls = [image, ...(images ?? [])].filter(Boolean) as string[]
    const seen = new Set<string>()
    const unique = urls.filter((url) => {
      if (seen.has(url)) return false
      seen.add(url)
      return true
    })
    return unique.slice(0, 6)
  }, [image, images])
  const optimizedImages = useMemo(
    () =>
      tileImages.map((url) => optimizeImageUrl(url, { width: targetW, height: targetH, format: "webp", dpr }) || url),
    [tileImages, targetW, targetH, dpr],
  )
  const src = optimizedImages[0] || image
  const shouldRenderCarousel = Boolean(targetW && targetH && optimizedImages.length > 1)
  const carouselWidth = targetW ?? 0
  const carouselHeight = targetH ?? 0
  const tapGesture = useTapOrSwipe({ onPress, maxDistance: 12 })
  const titleLineHeight = 20
  const priceSize: PriceSize = (() => {
    if (typeof targetW !== "number") {
      if (resolvedPadding === "lg") return "md"
      if (resolvedPadding === "sm" || resolvedPadding === "xs") return "xs"
      return "sm"
    }
    if (targetW >= 260) return "lg"
    if (targetW >= 210) return "md"
    if (targetW >= 170) return "sm"
    return "xs"
  })()
  const priceOverride = TILE_PRICE_SIZE_OVERRIDES[priceSize]

  return (
    <GestureDetector gesture={tapGesture}>
      <View
        className={cn("overflow-hidden", edgeToEdge ? undefined : "rounded-sm border-gray-200 border", className)}
        style={width ? { width } : undefined}
      >
        <View className={cn(cardChrome, "overflow-hidden")}>
          <View style={{ aspectRatio: imageRatio, backgroundColor: "#F5F5F7", overflow: "hidden" }}>
            {shouldRenderCarousel ? (
              <ProductTileCarousel
                images={optimizedImages}
                width={carouselWidth}
                height={carouselHeight}
                priority={priority}
              />
            ) : (
              <Image
                source={{ uri: src }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={priority === "high" ? 0 : 150}
                cachePolicy="disk"
                priority={priority ?? (width && width > 0 ? "normal" : "low")}
                placeholder={DEFAULT_PLACEHOLDER}
              />
            )}
          </View>

          <View className={cn(pad, "gap-2")}>
            <View style={{ minHeight: titleLineHeight * titleLines, justifyContent: "flex-start" }}>
              <Text
                className="text-primary text-[14px] font-semibold"
                style={{ lineHeight: titleLineHeight }}
                numberOfLines={titleLines}
              >
                {title}
              </Text>
            </View>
            <Price
              amount={price}
              compareAt={compareAt}
              currency={currency}
              size={priceSize}
              amountClassName={priceOverride.amount}
              compareAtClassName={priceOverride.compare}
              discountClassName={priceOverride.discount}
            />
          </View>
        </View>
      </View>
    </GestureDetector>
  )
}
