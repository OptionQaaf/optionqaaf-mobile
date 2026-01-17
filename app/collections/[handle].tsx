import { useMobileHome } from "@/features/home/api"
import { useCollectionMeta, useCollectionProductsWithImages } from "@/features/plp/api"
import { useSearch } from "@/features/search/api"
import { type ProductCollectionSortKeys, type ProductSortKeys } from "@/lib/shopify/gql/graphql"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { MetaobjectSectionList } from "@/ui/home/sections/MetaobjectSectionList"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { ProductTile } from "@/ui/product/ProductTile"
import { ProductTileSkeleton } from "@/ui/product/ProductTileSkeleton"
import { router, useLocalSearchParams } from "expo-router"
import { LayoutGrid, Square } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  FlatList,
  ImageBackground,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native"

const GRID_GAP = 8
const NEXT_PAGE_SKELETON_ROWS = 1

// Optional gradient for hero overlay
let LinearGradient: any
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  LinearGradient = require("expo-linear-gradient").LinearGradient
} catch {}

export default function CollectionScreen() {
  const { handle, q } = useLocalSearchParams<{ handle: string; q?: string }>()
  const h = typeof handle === "string" ? handle : ""
  const vendorName = typeof q === "string" ? q.trim() : ""
  const isVendorLanding = h === "vendors" && !!vendorName
  // special aesthetic PLP pages for empty men/women collections
  const SPECIAL: Record<string, { homeHandle: string; title: string; searchQuery: string }> = {
    "men-1": {
      homeHandle: "men-home",
      title: "Men",
      searchQuery: "men -title:cap* -tag:cap -product_type:Cap -product_type:Hat -title:hat*",
    },
    "women-1": {
      homeHandle: "women-home",
      title: "Women",
      searchQuery: "women -title:cap* -tag:cap -product_type:Cap -product_type:Hat -title:hat*",
    },
  }
  const special = SPECIAL[h]
  const { data: specialHome } = useMobileHome(special?.homeHandle ?? "")
  const { data: specialSearch } = useSearch(special?.searchQuery ?? "", 24)
  const specialSections = useMemo(() => specialHome?.sections ?? [], [specialHome?.sections])

  // controls state
  const [searchTerm, setSearchTerm] = useState("")
  const [view, setView] = useState<1 | 2>(2)

  // sorting/filters
  type SortOption = "newest" | "featured" | "priceAsc" | "priceDesc"
  const [sort, setSort] = useState<SortOption>("newest")

  const sortKey: ProductCollectionSortKeys =
    sort === "featured" ? "BEST_SELLING" : sort === "newest" ? "CREATED" : "PRICE"
  const searchSortKey: ProductSortKeys =
    sort === "featured" ? "BEST_SELLING" : sort === "newest" ? "CREATED_AT" : "PRICE"
  const reverse = sort === "priceDesc" || sort === "newest"

  const vendorSearch = useSearch(isVendorLanding ? vendorName : "", 24, { sortKey: searchSortKey, reverse })

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending: isCollectionPending,
    isFetching: isCollectionFetching,
  } = useCollectionProductsWithImages(h || "", 24, {
    sortKey,
    reverse,
  })
  const meta = useCollectionMeta(h || "")
  const collectionProducts = (data?.pages?.flatMap((p: any) => p.nodes) ?? []) as any[]
  const vendorProducts = useMemo(() => {
    if (!isVendorLanding) return [] as any[]
    const q = vendorName.toLowerCase()
    return (vendorSearch.data?.pages?.flatMap((p: any) => p.nodes) ?? []).filter(
      (p: any) => (p?.vendor ?? "").toLowerCase() === q,
    )
  }, [isVendorLanding, vendorName, vendorSearch.data])
  const products = (isVendorLanding ? vendorProducts : collectionProducts) as any[]
  const loadedCount = products.length
  const pageCount = isVendorLanding ? (vendorSearch.data?.pages?.length ?? 0) : (data?.pages?.length ?? 0)
  const activeHasNextPage = isVendorLanding ? vendorSearch.hasNextPage : hasNextPage
  const activeIsFetchingNextPage = isVendorLanding ? vendorSearch.isFetchingNextPage : isFetchingNextPage
  const activeFetchNextPage = isVendorLanding ? vendorSearch.fetchNextPage : fetchNextPage
  const reachedCap = !activeHasNextPage

  // derive hero image from first product if collection image not available
  const heroImage = isVendorLanding
    ? products?.[0]?.featuredImage?.url || undefined
    : (meta.data?.pages?.[0]?.image as string) || products?.[0]?.featuredImage?.url || undefined
  const title = isVendorLanding
    ? vendorName
    : meta.data?.pages?.[0]?.title || (h ? h.replace(/[-_]/g, " ").toUpperCase() : "Collection")

  const pillFilters = [
    {
      key: "newest",
      label: "Newest Drops",
      onPress: () => setSort("newest" as SortOption),
      active: sort === "newest",
    },
    {
      key: "featured",
      label: "Best Selling",
      onPress: () => setSort("featured" as SortOption),
      active: sort === "featured",
    },
    {
      key: "priceAsc",
      label: "Budget First",
      onPress: () => setSort("priceAsc" as SortOption),
      active: sort === "priceAsc",
    },
    {
      key: "priceDesc",
      label: "Premium First",
      onPress: () => setSort("priceDesc" as SortOption),
      active: sort === "priceDesc",
    },
  ] as const

  // Enable LayoutAnimation on Android for smooth grid resize (kept for view toggle)
  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true)
    }
  }, [])

  const selectView = (next: 1 | 2) => {
    if (next === view) return
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setView(next)
  }

  const visibleProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) {
      return products.filter((p) => p?.availableForSale !== false)
    }
    return products.filter((p) => {
      if (p?.availableForSale === false) return false
      const hay = `${p?.title ?? ""} ${p?.vendor ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [products, searchTerm])

  const isLoadingProducts = isVendorLanding
    ? vendorSearch.isPending || (vendorSearch.isFetching && products.length === 0)
    : isCollectionPending || (isCollectionFetching && products.length === 0)

  const metaHasData = Boolean(meta.data?.pages?.length)
  const heroMetaLoading = meta.isPending || (meta.isFetching && !metaHasData)
  const vendorHeroLoading =
    isVendorLanding && (vendorSearch.isPending || (vendorSearch.isFetching && vendorProducts.length === 0))
  const heroShouldSkeleton = !heroImage && (heroMetaLoading || vendorHeroLoading || isLoadingProducts)
  const heroState: "image" | "skeleton" | "fallback" = heroImage
    ? "image"
    : heroShouldSkeleton
      ? "skeleton"
      : "fallback"

  const gridItems = useMemo(() => {
    if (isLoadingProducts || !activeIsFetchingNextPage) {
      return visibleProducts
    }
    const remainder = visibleProducts.length % view
    const fillCount = remainder === 0 ? 0 : view - remainder
    const skeletonCount = fillCount + view * NEXT_PAGE_SKELETON_ROWS
    const placeholders =
      skeletonCount > 0
        ? Array.from({ length: skeletonCount }, (_, idx) => ({
            __skeleton: true,
            _key: `grid-skeleton-${idx}`,
          }))
        : []
    return [...visibleProducts, ...placeholders]
  }, [visibleProducts, activeIsFetchingNextPage, view, isLoadingProducts])

  // Auto-load more pages while searching and no results found yet
  useEffect(() => {
    const q = searchTerm.trim()
    if (!q) return
    if (visibleProducts.length > 0) return
    if (!activeHasNextPage || activeIsFetchingNextPage) return
    // Safety cap to avoid unbounded fetches
    if (loadedCount >= 120) return
    const t = setTimeout(() => {
      activeFetchNextPage()
    }, 80)
    return () => clearTimeout(t)
  }, [
    searchTerm,
    visibleProducts.length,
    activeHasNextPage,
    activeIsFetchingNextPage,
    loadedCount,
    activeFetchNextPage,
  ])

  const { width } = useWindowDimensions()
  const heroH = Math.max(280, Math.min(440, Math.round(width * 1.0)))
  const titleSize = Math.round(Math.min(72, Math.max(40, width * 0.16)))
  const gridPadding = 16
  const itemWidth = useMemo(() => {
    const totalGap = GRID_GAP * (view - 1)
    return Math.floor((width - gridPadding * 2 - totalGap) / view)
  }, [width, view])

  const listData = useMemo(() => {
    if (isLoadingProducts) {
      return Array.from({ length: view === 2 ? 6 : 4 }, (_, idx) => ({
        __skeleton: true,
        _key: `initial-skeleton-${idx}`,
      }))
    }
    return gridItems
  }, [gridItems, isLoadingProducts, view])

  const renderGridItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isRowEnd = (index + 1) % view === 0
      return (
        <View
          style={{
            width: itemWidth,
            marginRight: isRowEnd ? 0 : GRID_GAP,
            marginBottom: GRID_GAP,
          }}
        >
          {item?.__skeleton ? (
            <ProductTileSkeleton width={itemWidth} imageRatio={3 / 4} padding={view === 2 ? "sm" : "md"} />
          ) : (
            <ProductTile
              image={item?.featuredImage?.url ?? ""}
              images={(item?.images?.nodes ?? []).map((node: any) => node?.url).filter(Boolean)}
              brand={item?.vendor ?? ""}
              title={item?.title ?? ""}
              price={Number(item?.priceRange?.minVariantPrice?.amount ?? 0)}
              compareAt={(() => {
                const cmp = Number(item?.compareAtPriceRange?.minVariantPrice?.amount ?? 0)
                const amt = Number(item?.priceRange?.minVariantPrice?.amount ?? 0)
                return cmp > amt ? cmp : undefined
              })()}
              currency={(item?.priceRange?.minVariantPrice?.currencyCode as any) ?? "USD"}
              width={itemWidth}
              imageRatio={3 / 4}
              padding={view === 2 ? "sm" : "md"}
              onPress={() => {
                const h = item?.handle
                if (h) router.push(`/products/${h}` as any)
              }}
            />
          )}
        </View>
      )
    },
    [itemWidth, view],
  )

  // If special men-1 / women-1: render aesthetic sections + PLP-like grid
  if (special) {
    const sections = specialSections
    const go = (url?: string) => {
      if (!url) return
      const ABS = /^(https?:|mailto:|tel:|sms:)/i
      if (ABS.test(url)) Linking.openURL(url)
      else router.push(url as any)
    }
    return (
      <Screen bleedBottom bleedTop>
        <View className="flex-1 bg-white">
          <MenuBar floating />
          <PageScrollView contentContainerClassName="bg-white">
            <View className="pt-0">
              <MetaobjectSectionList sections={sections} onNavigate={go} />
            </View>
          </PageScrollView>
        </View>
      </Screen>
    )
  }

  return (
    <Screen bleedTop bleedBottom>
      <View className="flex-1 bg-white">
        <MenuBar floating />

        <FlatList
          data={listData}
          key={`collection-grid-${view}`}
          numColumns={view}
          keyExtractor={(item, index) => item?._key ?? item?.id ?? item?.handle ?? `${index}`}
          renderItem={renderGridItem}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (activeHasNextPage && !reachedCap && !activeIsFetchingNextPage) {
              activeFetchNextPage()
            }
          }}
          ListHeaderComponent={
            <View style={{ marginHorizontal: -gridPadding }}>
              {/* Hero */}
              <View className="w-full overflow-hidden" style={{ height: heroH }}>
                {heroState === "image" ? (
                  <ImageBackground source={{ uri: heroImage }} resizeMode="cover" className="flex-1">
                    {LinearGradient ? (
                      <LinearGradient
                        colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.55)"]}
                        start={{ x: 0.5, y: 0.1 }}
                        end={{ x: 0.5, y: 1 }}
                        className="absolute inset-0"
                      />
                    ) : null}
                    <View className="flex-1 items-center justify-end pb-6">
                      <Text
                        className="text-white font-extrabold px-4 text-center"
                        style={{
                          fontSize: titleSize,
                          textShadowColor: "rgba(0,0,0,0.2)",
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 2,
                        }}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        {title}
                      </Text>
                    </View>
                  </ImageBackground>
                ) : heroState === "skeleton" ? (
                  <View className="flex-1 bg-[#f1f5f9] px-4 pb-6 justify-end gap-3">
                    <View className="flex-row justify-center">
                      <Skeleton className="h-5 w-24 rounded-full bg-white/70" />
                    </View>
                    <Skeleton className="h-12 w-3/4 self-center rounded-3xl bg-white/80" />
                  </View>
                ) : (
                  <View className="flex-1 px-4 pb-6 items-center justify-end" style={{ backgroundColor: "#0f172a" }}>
                    <Text
                      className="text-white font-extrabold text-center"
                      style={{
                        fontSize: titleSize,
                        textShadowColor: "rgba(0,0,0,0.2)",
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 2,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                    >
                      {title}
                    </Text>
                  </View>
                )}
              </View>

              {/* Controls container */}
              <View className="px-4 -mt-8">
                <View className="flex-row items-center gap-4">
                  {/* search box */}
                  <View className="flex-1">
                    <View className="bg-white rounded-3xl border border-black/10 px-3 py-1.5 flex-row items-center justify-between">
                      <TextInput
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        placeholder="Search in collection"
                        placeholderTextColor="#6B7280"
                        className="flex-1 py-1 px-2"
                        style={{ textAlignVertical: "center" }}
                      />
                    </View>
                  </View>

                  {/* grid/list toggle */}
                  <View className="flex-row rounded-full bg-white border border-neutral-200 overflow-hidden p-0.5 relative">
                    <View
                      className={`absolute top-0.5 bottom-0.5 w-1/2 bg-[#8E1A26] rounded-full ${view === 1 ? "left-0.5" : "right-0.5"}`}
                    />
                    <Pressable onPress={() => selectView(1)} className="py-2.5 px-3 z-10">
                      <Square size={18} color={view === 1 ? "#FFF" : "#0B0B0B"} />
                    </Pressable>
                    <Pressable onPress={() => selectView(2)} className="py-2.5 px-3 z-10">
                      <LayoutGrid size={18} color={view === 2 ? "#FFF" : "#0B0B0B"} />
                    </Pressable>
                  </View>
                </View>

                {pillFilters.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mt-3"
                    contentContainerClassName="gap-2.5"
                  >
                    {pillFilters.map((pill) => (
                      <Pressable
                        key={pill.key}
                        onPress={pill.onPress}
                        className={`py-2.5 px-4 rounded-sm ${pill.active ? "bg-[#8E1A26]" : "bg-neutral-200"}`}
                      >
                        <Text className={`${pill.active ? "text-white" : "text-neutral-900"} font-bold`}>
                          {pill.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </View>

              <View className="mt-4" />
            </View>
          }
          ListEmptyComponent={
            !isLoadingProducts ? (
              <View className="items-center py-10">
                <Text className="text-neutral-900 font-bold text-lg mb-1.5">No products found</Text>
                <Text className="text-gray-500">Try adjusting filters or search.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            visibleProducts.length > 0 && reachedCap && !activeIsFetchingNextPage ? (
              <View className="py-6 items-center">
                <Text className="text-gray-500">You’ve reached the end</Text>
              </View>
            ) : (
              <View className="pb-8" />
            )
          }
          contentContainerStyle={{ paddingHorizontal: gridPadding, paddingBottom: 32 }}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          initialNumToRender={18}
          maxToRenderPerBatch={18}
          updateCellsBatchingPeriod={50}
          windowSize={11}
        />
      </View>
    </Screen>
  )
}
