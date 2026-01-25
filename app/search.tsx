import { useSearch } from "@/features/search/api"
import { optimizeImageUrl } from "@/lib/images/optimize"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { Screen } from "@/ui/layout/Screen"
import { defaultKeyboardShouldPersistTaps, verticalScrollProps } from "@/ui/layout/scrollDefaults"
import { useDeferredFooter } from "@/ui/layout/useDeferredFooter"
import { ProductTile } from "@/ui/product/ProductTile"
import { padToFullRow } from "@/ui/layout/gridUtils"
import { Image as ExpoImage } from "expo-image"
import { router } from "expo-router"
import { ChevronLeft, X } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { FlatList, PixelRatio, Pressable, Text, TextInput, useWindowDimensions, View } from "react-native"

export default function SearchScreen() {
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    const handle = setTimeout(() => setQuery(input), 250)
    return () => clearTimeout(handle)
  }, [input])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useSearch(query.trim(), 24)
  const trimmedInput = input.trim()
  const trimmedQuery = query.trim()
  const isTyping = trimmedInput.length > 0 && input !== query
  const showLoadingGrid = trimmedInput.length > 0 && (isTyping || isFetching)
  const {
    footerVisible,
    revealFooter,
    resetFooter,
    onLayout: onListLayout,
    onContentSizeChange: onListContentSize,
  } = useDeferredFooter()
  const endReachedRef = useRef(false)

  const nodes = useMemo(() => {
    const arr: any[] = (data?.pages?.flatMap((p) => p.nodes) ?? []) as any[]
    // Hide out-of-stock by default
    return arr.filter((p) => p?.availableForSale !== false)
  }, [data])
  const gridNodes = useMemo(() => padToFullRow(nodes, 2), [nodes])

  const { width } = useWindowDimensions()
  const padH = 16 // px-4
  const gap = 8
  const itemW = Math.floor((width - padH * 2 - gap) / 2)

  // Prefetch first screen of images for snappy appearance
  useEffect(() => {
    const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
    const urls = nodes.slice(0, 8).map(
      (n: any) =>
        optimizeImageUrl(n?.featuredImage?.url, {
          width: itemW,
          height: Math.round(itemW * (3 / 4)),
          format: "webp",
          dpr,
        }) || n?.featuredImage?.url,
    )
    const list = urls.filter(Boolean) as string[]
    if (list.length) ExpoImage.prefetch(list)
  }, [nodes, itemW])

  useEffect(() => {
    resetFooter()
    endReachedRef.current = false
  }, [query, resetFooter])

  useEffect(() => {
    if (!hasNextPage && endReachedRef.current) revealFooter()
  }, [hasNextPage, revealFooter])

  const renderFooter = useMemo(() => {
    if (!isFetchingNextPage && !footerVisible) return null
    return (
      <View style={{ paddingTop: 24 }}>
        {isFetchingNextPage ? (
          <View className="mb-6">
            <View className="flex-row gap-3">
              <Skeleton className="flex-1 rounded-3xl" style={{ aspectRatio: 3 / 4 }} />
              <Skeleton className="flex-1 rounded-3xl" style={{ aspectRatio: 3 / 4 }} />
            </View>
          </View>
        ) : null}
      </View>
    )
  }, [footerVisible, isFetchingNextPage])

  return (
    <Screen bleedBottom>
      {/* Minimal header: back + search input */}
      <View className="px-4 py-2">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-2xl">
            <ChevronLeft size={22} color="#0B0B0B" />
          </Pressable>
          <View className="flex-1 bg-white rounded-3xl border border-black/10 h-11 px-3 flex-row items-center gap-2">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Search products"
              placeholderTextColor="#6B7280"
              className="flex-1 h-full py-0 px-2"
              style={{ textAlignVertical: "center" }}
              returnKeyType="search"
              autoFocus
              allowFontScaling={false}
              multiline={false}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {input ? (
              <Pressable onPress={() => setInput("")} className="h-9 w-9 items-center justify-center rounded-2xl">
                <X size={18} color="#0B0B0B" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <FlatList
        {...verticalScrollProps}
        onLayout={onListLayout}
        onContentSizeChange={onListContentSize}
        data={gridNodes}
        keyExtractor={(item: any, i) => (item ? (item?.id ?? item?.handle ?? String(i)) : `placeholder-${i}`)}
        numColumns={2}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ paddingHorizontal: padH, paddingVertical: 24, rowGap: gap }}
        ListHeaderComponent={
          <View className="px-0">
            {showLoadingGrid && nodes.length === 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: gap, rowGap: gap }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <View key={idx} style={{ width: itemW }}>
                    <Skeleton className="rounded-3xl" style={{ aspectRatio: 3 / 4, width: "100%" }} />
                    <Skeleton className="rounded-full mt-2" style={{ height: 12, width: "70%" }} />
                    <Skeleton className="rounded-full mt-1.5" style={{ height: 12, width: "50%" }} />
                  </View>
                ))}
              </View>
            ) : null}
            {!trimmedInput && !showLoadingGrid ? (
              <View className="items-center py-10">
                <Text className="text-secondary">Start typing to search products</Text>
              </View>
            ) : null}
            {trimmedQuery && nodes.length === 0 && !isFetching && !showLoadingGrid ? (
              <View className="items-center py-10">
                <Text className="text-black font-bold text-lg mb-1.5">No products found</Text>
                <Text className="text-gray-500">Try a different keyword.</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }: any) => {
          if (!item) {
            return <View style={{ width: itemW }} />
          }
          return (
            <View style={{ width: itemW }}>
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
                padding="sm"
                priority={index < 6 ? "high" : "normal"}
                onPress={() =>
                  item?.handle &&
                  router.push({
                    pathname: "/products/[handle]",
                    params: {
                      handle: item.handle,
                      variant:
                        (item as any).__variantId != null
                          ? encodeURIComponent(String((item as any).__variantId))
                          : undefined,
                      code:
                        (item as any).__variantCode != null
                          ? encodeURIComponent(String((item as any).__variantCode))
                          : undefined,
                    },
                  })
                }
              />
            </View>
          )
        }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          endReachedRef.current = true
          if (query.trim() && hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
            return
          }
          if (!hasNextPage || !query.trim()) {
            revealFooter()
          }
        }}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps={defaultKeyboardShouldPersistTaps}
        scrollIndicatorInsets={{ bottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={renderFooter}
      />
    </Screen>
  )
}
