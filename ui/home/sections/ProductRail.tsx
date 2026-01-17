import { useCollectionProducts } from "@/features/plp/api"
import { ProductTile } from "@/ui/product/ProductTile"
import { router } from "expo-router"
import { FlatList, View, useWindowDimensions } from "react-native"
import { useMemo, useRef } from "react"
import type { SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"

type Props = { collectionHandle?: string; size?: SectionSize }

export function ProductRail({ collectionHandle, size }: Props) {
  const { width } = useWindowDimensions()
  const scale = sizeScale(size)
  const widthScale = Math.min(1.15, Math.max(0.8, scale))
  const cardWidth = Math.round((width / 2.2) * widthScale)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCollectionProducts(collectionHandle ?? "", 24)
  const warnedMissingHandle = useRef(false)

  const products = (data?.pages?.flatMap((p) => p.nodes) ?? []).slice(0, 10)
  const tiles = useMemo(() => {
    const toNumber = (value?: string | null) => {
      if (typeof value !== "string") return undefined
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }
    return products
      .map((product) => {
        if (!product) return null
        const image = product.featuredImage?.url?.toString?.() ?? product.featuredImage?.url
        const price = toNumber(product.priceRange?.minVariantPrice?.amount)
        if (!image || typeof price !== "number") return null
        const compareAt = toNumber(product.compareAtPriceRange?.minVariantPrice?.amount)
        const currency =
          product.priceRange?.minVariantPrice?.currencyCode ??
          product.compareAtPriceRange?.minVariantPrice?.currencyCode ??
          "USD"
        return {
          id: product.id,
          handle: product.handle,
          image,
          brand: product.vendor ?? "",
          title: product.title ?? "",
          price,
          compareAt: compareAt,
          currency,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [products])

  if (!collectionHandle && __DEV__ && !warnedMissingHandle.current) {
    warnedMissingHandle.current = true
    console.warn("[Home] product_rail missing collection handle; nothing to render")
  }

  if (!collectionHandle) return null

  return (
    <View className="w-full">
      <FlatList
        horizontal
        data={tiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductTile
            image={item.image}
            brand={item.brand}
            title={item.title}
            price={item.price}
            compareAt={item.compareAt}
            currency={item.currency}
            width={cardWidth}
            padding="xs"
            imageAspect={0.82}
            edgeToEdge
            onPress={() => {
              if (collectionHandle) router.push(`/collections/${collectionHandle}` as any)
            }}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 0 }}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage()
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  )
}
