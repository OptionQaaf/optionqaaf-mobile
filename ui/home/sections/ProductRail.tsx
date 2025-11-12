import { useCollectionProducts } from "@/features/plp/api"
import { HomeProductTile } from "@/ui/product/HomeProductTile"
import { router } from "expo-router"
import { FlatList, View, useWindowDimensions } from "react-native"
import { useRef } from "react"
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

  if (!collectionHandle && __DEV__ && !warnedMissingHandle.current) {
    warnedMissingHandle.current = true
    console.warn("[Home] product_rail missing collection handle; nothing to render")
  }

  if (!collectionHandle) return null

  return (
    <View className="w-full">
      <FlatList
        horizontal
        data={products}
        keyExtractor={(p: any) => p.id}
        renderItem={({ item }) => (
          <HomeProductTile
            image={item?.featuredImage?.url?.toString?.() ?? item?.featuredImage?.url ?? ""}
            brand={item?.vendor ?? ""}
            title={item?.title ?? ""}
            price={undefined}
            width={cardWidth}
            ratio={0.85}
            rounded="none"
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
