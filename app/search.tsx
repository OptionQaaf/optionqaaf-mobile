import { useSearch } from "@/features/search/api"
import { Screen } from "@/ui/layout/Screen"
import { ProductTile } from "@/ui/product/ProductTile"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { ChevronLeft, X } from "lucide-react-native"
import { router } from "expo-router"
import React, { useMemo, useState } from "react"
import { Pressable, ScrollView, Text, TextInput, View } from "react-native"

export default function SearchScreen() {
  const [query, setQuery] = useState("")
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useSearch(query.trim(), 24)

  const nodes = useMemo(() => {
    const arr: any[] = (data?.pages?.flatMap((p) => p.nodes) ?? []) as any[]
    // Hide out-of-stock by default
    return arr.filter((p) => p?.availableForSale !== false)
  }, [data])

  return (
    <Screen>
      {/* Minimal header: back + search input */}
      <View className="px-4 pt-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-2xl">
            <ChevronLeft size={22} color="#0B0B0B" />
          </Pressable>
          <View className="flex-1 bg-white rounded-3xl border border-black/10 h-11 px-3 flex-row items-center gap-2">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search products"
              className="flex-1 h-full py-0 px-2"
              style={{ textAlignVertical: "center" }}
              returnKeyType="search"
              autoFocus
              allowFontScaling={false}
              multiline={false}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} className="h-9 w-9 items-center justify-center rounded-2xl">
                <X size={18} color="#0B0B0B" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="pb-6"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
          const threshold = 400
          if (
            query.trim() &&
            hasNextPage &&
            !isFetchingNextPage &&
            contentOffset.y + layoutMeasurement.height > contentSize.height - threshold
          ) {
            fetchNextPage()
          }
        }}
      >

        <View className="px-4 mt-4">
          {!query.trim() ? (
            <View className="items-center py-10">
              <Text className="text-secondary">Start typing to search products</Text>
            </View>
          ) : null}

          {query.trim() && nodes.length === 0 && !isFetching ? (
            <View className="items-center py-10">
              <Text className="text-black font-bold text-lg mb-1.5">No products found</Text>
              <Text className="text-gray-500">Try a different keyword.</Text>
            </View>
          ) : null}

          {nodes.length > 0 ? (
            <StaticProductGrid
              data={nodes}
              columns={2}
              gap={14}
              renderItem={(item: any, itemW: number) => (
                <ProductTile
                  image={item?.featuredImage?.url ?? ""}
                  brand={item?.vendor ?? ""}
                  title={item?.title ?? ""}
                  price={Number(item?.priceRange?.minVariantPrice?.amount ?? 0)}
                  compareAt={(() => {
                    const cmp = Number(item?.compareAtPriceRange?.minVariantPrice?.amount ?? 0)
                    const amt = Number(item?.priceRange?.minVariantPrice?.amount ?? 0)
                    return cmp > amt ? cmp : undefined
                  })()}
                  currency={(item?.priceRange?.minVariantPrice?.currencyCode as any) ?? "USD"}
                  width={itemW}
                  imageRatio={3 / 4}
                  rounded="3xl"
                  padding="md"
                  onPress={() => item?.handle && router.push(`/products/${item.handle}` as any)}
                />
              )}
            />
          ) : null}

          {isFetchingNextPage ? (
            <View className="mt-3">
              <View className="flex-row gap-3">
                <Skeleton className="flex-1 rounded-3xl" style={{ aspectRatio: 3 / 4 }} />
                <Skeleton className="flex-1 rounded-3xl" style={{ aspectRatio: 3 / 4 }} />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  )
}
