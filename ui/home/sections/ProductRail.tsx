import { useCollectionProducts } from "@/features/plp/api"
import { HomeProductTile } from "@/ui/product/HomeProductTile"
import { router } from "expo-router"
import { FlatList, View, useWindowDimensions } from "react-native"

type Props = { title?: string; collectionHandle?: string }

export function ProductRail({ collectionHandle }: Props) {
  const { width } = useWindowDimensions()
  const cardWidth = Math.round(width / 2)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCollectionProducts(collectionHandle ?? "", 24)

  const products = (data?.pages?.flatMap((p) => p.nodes) ?? []).slice(0, 10)

  return (
    <View className="w-full">
      {collectionHandle ? (
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
              ratio={1}
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
      ) : null}
    </View>
  )
}
