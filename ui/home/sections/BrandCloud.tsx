import { useBrandIndex } from "@/features/brands/api"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { cn } from "@/ui/utils/cva"
import { Image } from "expo-image"
import { memo, useMemo, useState } from "react"
import { Pressable, Text, View } from "react-native"

import type { BrandSummary } from "@/lib/shopify/services/brands"

type Props = {
  title?: string
}

const PLACEHOLDER = Array.from({ length: 12 })

export const BrandCloud = memo(function BrandCloud({ title }: Props) {
  const { data, isLoading } = useBrandIndex()
  const brands = useMemo(() => (data ?? []).filter((brand) => brand.productCount > 0), [data])
  const [active, setActive] = useState<BrandSummary | null>(null)

  const activate = (brand: BrandSummary | null) => {
    setActive(brand)
  }

  if (isLoading) {
    return (
      <View className="w-full bg-white px-4 py-12">
        {title ? <Skeleton className="mb-6 h-4 w-36" /> : null}
        <View className="flex-row flex-wrap justify-center">
          {PLACEHOLDER.map((_, idx) => (
            <Skeleton key={`brand-cloud-placeholder-${idx}`} className="mx-1 my-1 h-9 w-28 rounded-full" />
          ))}
        </View>
      </View>
    )
  }

  if (!brands.length) return null

  const overlayImage = active?.featuredImage?.url

  return (
    <View className="w-full bg-white px-4 py-12">
      {title ? <Text className="mb-6 text-xs uppercase tracking-[4px] text-neutral-500">{title}</Text> : null}
      <View className="mb-8 items-center justify-center" style={{ minHeight: 320 }}>
        {overlayImage ? (
          <>
            <View className="overflow-hidden rounded-[32px] border border-white/50 bg-black/5 shadow-lg">
              <Image
                source={{ uri: overlayImage }}
                style={{ width: 240, height: 320 }}
                contentFit="cover"
                transition={150}
              />
            </View>
            <Text className="mt-3 text-sm font-semibold uppercase tracking-[4px] text-neutral-500">
              {active?.name}
            </Text>
          </>
        ) : (
          <View className="h-full w-full items-center justify-center">
            <View className="h-[300px] w-[220px] items-center justify-center rounded-[32px] border border-dashed border-neutral-200 bg-neutral-50">
              <Text className="text-xs uppercase tracking-[4px] text-neutral-300">Tap a brand</Text>
            </View>
          </View>
        )}
      </View>
      <View className="flex-row flex-wrap justify-center">
          {brands.map((brand) => {
            const isActive = active?.name === brand.name
            const countLabel = brand.productCount.toLocaleString()
            return (
              <Pressable
                key={brand.name}
                className={cn(
                  "mx-1 my-1 rounded-full border px-3 py-2",
                  isActive ? "border-neutral-900 bg-neutral-900" : "border-neutral-200 bg-neutral-50",
                )}
                onPressIn={() => activate(brand)}
                onPressOut={() => activate(null)}
                onHoverIn={() => activate(brand)}
                onHoverOut={() => activate(null)}
              >
                <Text
                  className={cn(
                    "text-sm font-semibold tracking-wide",
                    isActive ? "text-white" : "text-neutral-700",
                  )}
                >
                  {brand.name}
                  <Text className={cn("text-xs font-normal", isActive ? "text-white/80" : "text-neutral-400")}>{` · ${countLabel}`}</Text>
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
})
