import { useBrandIndex } from "@/features/brands/api"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { cn } from "@/ui/utils/cva"
import { memo, useMemo, useState } from "react"
import { Linking, Pressable, Text, View } from "react-native"

import type { BrandSummary } from "@/lib/shopify/services/brands"

type Props = {
  title?: string
  onPressBrand?: (url?: string) => void
}

const PLACEHOLDER = Array.from({ length: 12 })

export const BrandCloud = memo(function BrandCloud({ title, onPressBrand }: Props) {
  const { data, isLoading } = useBrandIndex()
  const brands = useMemo(() => data ?? [], [data])
  const [active, setActive] = useState<BrandSummary | null>(null)

  const activate = (brand: BrandSummary | null) => {
    setActive(brand)
  }

  const openBrand = (brand: BrandSummary) => {
    const target = brand.url
    if (!target) return
    if (target.startsWith("http")) {
      Linking.openURL(target).catch(() => {})
    } else {
      onPressBrand?.(target)
    }
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

  return (
    <View className="w-full bg-white px-4 py-12">
      {title ? <Text className="mb-6 text-xs uppercase tracking-[4px] text-neutral-500">{title}</Text> : null}
      <View className="mb-8 items-center justify-center" style={{ minHeight: 120 }}>
        <View className="h-[120px] w-full items-center justify-center rounded-[32px] border border-dashed border-neutral-200 bg-neutral-50">
          <Text className="text-xs uppercase tracking-[4px] text-neutral-300">
            {active?.name ? `Explore ${active.name}` : "Tap a brand"}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap justify-center">
        {brands.map((brand) => {
          const isActive = active?.name === brand.name
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
              onPress={() => openBrand(brand)}
            >
              <Text
                className={cn(
                  "text-sm font-semibold tracking-wide",
                  isActive ? "text-white" : "text-neutral-700",
                )}
              >
                {brand.name}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
})
