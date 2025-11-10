import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Button } from "@/ui/primitives/Button"
import { cn } from "@/ui/utils/cva"
import { Image as ExpoImage } from "expo-image"
import { ChevronRight } from "lucide-react-native"
import { memo, useMemo } from "react"
import { Text, View } from "react-native"

export type BrandCardPriceRange = {
  min: number
  max: number
  currency: string
}

type Props = {
  name: string
  productCount?: number
  images?: string[]
  priceRange?: BrandCardPriceRange | null
  loading?: boolean
  onPress?: () => void
}

export const BrandCard = memo(function BrandCard({ name, productCount, images, priceRange, loading, onPress }: Props) {
  const formatter = useMemo(() => {
    if (!priceRange) return null
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: priceRange.currency,
        maximumFractionDigits: 0,
      })
    } catch {
      return null
    }
  }, [priceRange])

  const priceSummary = useMemo(() => {
    if (!priceRange || !formatter) return null
    const { min, max } = priceRange
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    const low = formatter.format(Math.max(0, min))
    const high = formatter.format(Math.max(0, max))
    if (Math.abs(max - min) < 1) return `Typical price • ${low}`
    return `Popular price range • ${low} – ${high}`
  }, [priceRange, formatter])

  const previews = useMemo(() => {
    return (images ?? []).filter(Boolean).slice(0, 3)
  }, [images])

  const summary = useMemo(() => {
    if (typeof productCount === "number" && productCount > 0) {
      if (productCount === 1) return "1 item available"
      if (productCount < 8) return `Discover ${productCount} curated picks`
      return `Explore ${productCount}+ items from ${name}`
    }
    return `Discover more from ${name}`
  }, [productCount, name])

  return (
    <PressableOverlay
      className="flex-row items-center justify-between rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-4"
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`View brand ${name}`}
      haptic="light"
    >
      <View className="flex-1 pr-4">
        <Text className="mt-1 text-[18px] font-extrabold text-primary" numberOfLines={1}>
          {name}
        </Text>
        {loading ? (
          <View className="mt-3">
            <Skeleton className="mb-2 h-3 w-36" />
            <Skeleton className="h-3 w-24" />
          </View>
        ) : (
          <>
            <Text className="mt-2 text-[14px] text-secondary" numberOfLines={2}>
              {summary}
            </Text>
            {priceSummary ? (
              <Text className="mt-1 text-[12px] text-neutral-500" numberOfLines={1}>
                {priceSummary}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <View className="items-end">
        {previews.length ? (
          <View className="mb-3 flex-row items-center justify-end">
            {previews.map((src, idx) => {
              const uri = optimizeImageUrl(src, { width: 120, height: 120, format: "webp" }) ?? src
              return (
                <ExpoImage
                  key={`${src}-${idx}`}
                  source={{ uri }}
                  placeholder={DEFAULT_PLACEHOLDER}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    marginLeft: idx === 0 ? 0 : -14,
                    borderWidth: 2,
                    borderColor: "#FFFFFF",
                    backgroundColor: "#E5E7EB",
                  }}
                  contentFit="cover"
                />
              )
            })}
          </View>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onPress={onPress}
          className={cn(previews.length ? "" : "mt-1")}
          rightIcon={<ChevronRight size={16} color="#0B0B0B" strokeWidth={2} />}
        >
          View brand
        </Button>
      </View>
    </PressableOverlay>
  )
})
