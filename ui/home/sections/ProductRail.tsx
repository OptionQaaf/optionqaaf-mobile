import { useCollectionProducts } from "@/features/plp/api"
import { ProductTile } from "@/ui/product/ProductTile"
import { FlatList, View } from "react-native"

type Props = { title?: string; subtitle?: string; collectionHandle?: string }

export function ProductRail({ collectionHandle }: Props) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCollectionProducts(collectionHandle ?? "", 24)

  const products = data?.pages?.flatMap((p) => p.nodes) ?? []

  return (
    <View className="w-full">
      <FlatList
        horizontal
        data={products}
        keyExtractor={(p: any) => p.id}
        renderItem={({ item }) => <ProductTile {...item} />}
        showsHorizontalScrollIndicator={false}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage()
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  )
}
