import { useMobileHome } from "@/features/home/api"
import { useCollectionMeta, useCollectionProducts } from "@/features/plp/api"
import { useSearch } from "@/features/search/api"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { sectionRegistry } from "@/ui/home/sections/registry"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { ProductTile } from "@/ui/product/ProductTile"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { SpecialLanding } from "@/ui/special/SpecialLanding"
import { router, useLocalSearchParams } from "expo-router"
import { Filter, LayoutGrid, Square } from "lucide-react-native"
import React, { useEffect, useMemo, useState } from "react"
import {
  Animated,
  ImageBackground,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native"

// Optional gradient for hero overlay
let LinearGradient: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LinearGradient = require("expo-linear-gradient").LinearGradient
} catch {}

export default function CollectionScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const h = typeof handle === "string" ? handle : ""
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
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCollectionProducts(h || "", 24)
  const meta = useCollectionMeta(h || "")
  const products = (data?.pages?.flatMap((p: any) => p.nodes) ?? []) as any[]
  const loadedCount = products.length
  const pageCount = data?.pages?.length ?? 0
  const reachedCap = pageCount >= 5

  // derive hero image from first product if collection image not available
  const heroImage = (meta.data?.pages?.[0]?.image as string) || products?.[0]?.featuredImage?.url || undefined
  const title = meta.data?.pages?.[0]?.title || (h ? h.replace(/[-_]/g, " ").toUpperCase() : "Collection")

  // controls state
  const [query, setQuery] = useState("")
  const [view, setView] = useState<1 | 2>(2)
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [sort, setSort] = useState<"featured" | "priceAsc" | "priceDesc">("featured")
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const sheetProgress = React.useRef(new Animated.Value(0)).current
  const openFilters = () => {
    setShowFilters(true)
    sheetProgress.setValue(0)
    Animated.timing(sheetProgress, { toValue: 1, duration: 220, useNativeDriver: true }).start()
  }
  const closeFilters = () => {
    Animated.timing(sheetProgress, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setShowFilters(false)
    })
  }

  // removed eager fetch here; see targeted fetch below based on zero results

  // Enable LayoutAnimation on Android for smooth grid resize
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

  const vendors = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) if (p?.vendor) set.add(p.vendor)
    return Array.from(set).slice(0, 12)
  }, [products])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const vset = new Set(selectedVendors)
    const min = minPrice ? Number(minPrice) : -Infinity
    const max = maxPrice ? Number(maxPrice) : Infinity
    const base = products.filter((p) => {
      // Hide out-of-stock products by default
      if (p?.availableForSale === false) return false
      if (vset.size > 0 && !vset.has(p?.vendor)) return false
      const price = Number(p?.priceRange?.minVariantPrice?.amount ?? 0)
      if (price < min || price > max) return false
      if (!q) return true
      const hay = `${p?.title ?? ""} ${p?.vendor ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
    if (sort === "priceAsc" || sort === "priceDesc") {
      const arr = [...base]
      arr.sort((a, b) => {
        const pa = Number(a?.priceRange?.minVariantPrice?.amount ?? 0)
        const pb = Number(b?.priceRange?.minVariantPrice?.amount ?? 0)
        return sort === "priceAsc" ? pa - pb : pb - pa
      })
      return arr
    }
    return base
  }, [products, query, selectedVendors, sort, minPrice, maxPrice])

  // Auto-load more pages while searching and no results found yet
  useEffect(() => {
    const q = query.trim()
    if (!q) return
    if (filtered.length > 0) return
    if (!hasNextPage || isFetchingNextPage) return
    // Safety cap to avoid unbounded fetches
    if (loadedCount >= 120) return
    const t = setTimeout(() => {
      fetchNextPage()
    }, 80)
    return () => clearTimeout(t)
  }, [query, filtered.length, hasNextPage, isFetchingNextPage, loadedCount, fetchNextPage])

  const { width } = useWindowDimensions()
  const heroH = Math.max(280, Math.min(440, Math.round(width * 1.0)))
  const titleSize = Math.round(Math.min(72, Math.max(40, width * 0.16)))

  // If special men-1 / women-1: render aesthetic sections + PLP-like grid
  if (special) {
    const sections = specialHome?.sections ?? []
    const capsuleHandles = useMemo(() => {
      const handles: string[] = []
      for (const section of sections) {
        if (section?.kind === "product_rail" && section.collectionHandle) {
          if (!handles.includes(section.collectionHandle)) handles.push(section.collectionHandle)
        }
      }
      return handles.slice(0, 3)
    }, [sections])
    const products = (specialSearch?.pages?.flatMap((p) => p.nodes) ?? []).slice(0, 24)
    const go = (url?: string) => {
      if (!url) return
      const ABS = /^(https?:|mailto:|tel:|sms:)/i
      if (ABS.test(url)) Linking.openURL(url)
      else router.push(url as any)
    }
    return (
      <Screen bleedBottom bleedTop>
        <View className="flex-1 bg-white">
          <MenuBar variant="dark" floating />
          <PageScrollView>
            <View className="pt-0">
              {/* Always lead with a composed landing to set the vibe */}
              <SpecialLanding variant={special.title as any} collectionHandles={capsuleHandles} />

              {/* If metaobject sections exist, render them next */}
              {sections.map((s: any) => {
                const Cmp = (sectionRegistry as any)[s.kind]
                if (!Cmp) return null
                switch (s.kind) {
                  case "duo_poster":
                    return (
                      <Cmp
                        key={s.id}
                        {...s}
                        onPressLeft={() => go(s.left?.url)}
                        onPressRight={() => go(s.right?.url)}
                      />
                    )
                  case "trio_grid":
                    return (
                      <Cmp
                        key={s.id}
                        {...s}
                        onPressA={() => go(s.a?.url)}
                        onPressB={() => go(s.b?.url)}
                        onPressC={() => go(s.c?.url)}
                      />
                    )
                  default:
                    return <Cmp key={s.id} {...s} onPress={() => go((s as any).url)} />
                }
              })}

              <View className="mt-2">
                <Text className="px-4 text-[28px] font-extrabold text-primary mb-3">{special.title}</Text>
                <StaticProductGrid
                  data={products}
                  columns={2}
                  renderItem={(item: any, w: number) => (
                    <ProductTile
                      image={item?.featuredImage?.url ?? ""}
                      brand={item?.vendor ?? ""}
                      title={item?.title ?? ""}
                      price={Number(item?.priceRange?.minVariantPrice?.amount ?? 0)}
                      compareAt={undefined}
                      currency={(item?.priceRange?.minVariantPrice?.currencyCode as any) ?? "USD"}
                      width={w}
                      imageRatio={3 / 4}
                      padding="sm"
                      onPress={() => item?.handle && router.push(`/products/${item.handle}` as any)}
                    />
                  )}
                />
              </View>
            </View>
          </PageScrollView>
        </View>
      </Screen>
    )
  }

  return (
    <Screen bleedTop bleedBottom>
      <View className="flex-1 bg-white">
        <MenuBar variant="light" floating />

        <PageScrollView
          scrollEventThrottle={16}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
            const threshold = 400
            if (
              hasNextPage &&
              !reachedCap &&
              !isFetchingNextPage &&
              contentOffset.y + layoutMeasurement.height > contentSize.height - threshold
            ) {
              fetchNextPage()
            }
          }}
        >
          {/* Hero */}
          <View className="w-full" style={{ height: heroH }}>
            {heroImage ? (
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
                    style={{ fontSize: titleSize }}
                    numberOfLines={2}
                  >
                    {title}
                  </Text>
                </View>
              </ImageBackground>
            ) : null}
          </View>

          {/* Controls container */}
          <View className="px-4 -mt-8">
            {/* One row: search (with filter icon inside), and a single toggle box for grid/list */}
            <View className="flex-row items-center gap-4">
              {/* search box with filter icon inside */}
              <View className="flex-1">
                <View className="bg-white rounded-3xl border border-black/10 px-3 py-1.5 flex-row items-center justify-between">
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search in collection"
                    placeholderTextColor="#6B7280"
                    className="flex-1 py-1 px-2"
                    style={{ textAlignVertical: "center" }}
                  />
                  <Pressable onPress={openFilters} className="p-1.5">
                    <Filter size={20} color="#0B0B0B" />
                  </Pressable>
                </View>
              </View>
              {/* segmented grid/list toggle with pill thumb */}
              <View className="flex-row rounded-full bg-white border border-neutral-200 overflow-hidden p-0.5 relative">
                {/* pill thumb */}
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

            {/* Filter modal: overlay fades, sheet slides up */}
            <Modal visible={showFilters} animationType="none" transparent onRequestClose={closeFilters}>
              <View className="flex-1">
                <Animated.View className="absolute inset-0 bg-black/60" style={{ opacity: sheetProgress }} />
                <Pressable className="absolute inset-0" onPress={closeFilters} />
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : undefined}
                  className="flex-1 justify-end"
                >
                  <Animated.View
                    className="bg-white rounded-t-3xl px-4 pt-4 pb-6"
                    style={{
                      transform: [
                        { translateY: sheetProgress.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) },
                      ],
                    }}
                  >
                    <Text className="font-extrabold text-lg mb-3">Filters</Text>

                    {/* Sort */}
                    <Text className="font-bold mb-2">Sort by</Text>
                    <View className="flex-row flex-wrap gap-2.5 mb-3">
                      {(
                        [
                          { key: "featured", label: "Featured" },
                          { key: "priceAsc", label: "Price: Low → High" },
                          { key: "priceDesc", label: "Price: High → Low" },
                        ] as const
                      ).map((opt) => (
                        <Pressable
                          key={opt.key}
                          onPress={() => setSort(opt.key)}
                          className={`py-2 px-3 rounded-full ${sort === opt.key ? "bg-[#8E1A26]" : "bg-neutral-200"}`}
                        >
                          <Text className={`${sort === opt.key ? "text-white" : "text-black"} font-bold`}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {/* Vendors multi-select */}
                    {vendors.length > 0 ? (
                      <>
                        <Text className="font-bold mb-2">Brands</Text>
                        <View className="flex-row flex-wrap gap-2.5 mb-3">
                          {vendors.map((v) => {
                            const active = selectedVendors.includes(v)
                            return (
                              <Pressable
                                key={v}
                                onPress={() => {
                                  setSelectedVendors((prev) =>
                                    prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
                                  )
                                }}
                                className={`py-2 px-3 rounded-full ${active ? "bg-[#8E1A26]" : "bg-neutral-200"}`}
                              >
                                <Text className={`${active ? "text-white" : "text-black"} font-bold`}>{v}</Text>
                              </Pressable>
                            )
                          })}
                        </View>
                      </>
                    ) : null}

                    {/* Price range */}
                    <Text className="font-bold mb-2">Price range</Text>
                    <View className="flex-row gap-2.5 mb-4">
                      <TextInput
                        value={minPrice}
                        onChangeText={setMinPrice}
                        placeholder="Min"
                        placeholderTextColor="#6B7280"
                        keyboardType="numeric"
                        className="flex-1 border border-neutral-200 rounded-xl p-2"
                      />
                      <TextInput
                        value={maxPrice}
                        onChangeText={setMaxPrice}
                        placeholder="Max"
                        placeholderTextColor="#6B7280"
                        keyboardType="numeric"
                        className="flex-1 border border-neutral-200 rounded-xl p-2"
                      />
                    </View>

                    {/* Actions */}
                    <View className="flex-row justify-between gap-3">
                      <Pressable
                        onPress={() => {
                          setSelectedVendors([])
                          setMinPrice("")
                          setMaxPrice("")
                          setSort("featured")
                          setQuery("")
                        }}
                        className="flex-1 py-3 rounded-xl bg-neutral-100 items-center"
                      >
                        <Text className="font-bold text-black">Clear</Text>
                      </Pressable>
                      <Pressable onPress={closeFilters} className="flex-1 py-3 rounded-xl bg-[#8E1A26] items-center">
                        <Text className="font-bold text-white">Apply</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                </KeyboardAvoidingView>
              </View>
            </Modal>

            {/* Active filters summary + Clear All */}
            {selectedVendors.length > 0 || minPrice || maxPrice || sort !== "featured" || query ? (
              <View className="flex-row items-center flex-wrap gap-2 mt-3">
                {query ? (
                  <View className="py-1.5 px-3 rounded-full bg-neutral-200">
                    <Text className="font-semibold text-black">Query: {query}</Text>
                  </View>
                ) : null}
                {selectedVendors.map((v) => (
                  <View key={`vf-${v}`} className="py-1.5 px-3 rounded-full bg-neutral-200">
                    <Text className="font-semibold text-black">Brand: {v}</Text>
                  </View>
                ))}
                {minPrice || maxPrice ? (
                  <View className="py-1.5 px-3 rounded-full bg-neutral-200">
                    <Text className="font-semibold text-black">
                      Price: {minPrice || "0"} - {maxPrice || "∞"}
                    </Text>
                  </View>
                ) : null}
                {sort !== "featured" ? (
                  <View className="py-1.5 px-3 rounded-full bg-neutral-200">
                    <Text className="font-semibold text-black">Sort: {sort}</Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => {
                    setSelectedVendors([])
                    setMinPrice("")
                    setMaxPrice("")
                    setSort("featured")
                    setQuery("")
                  }}
                  className="ml-auto py-2 px-3 rounded-xl bg-neutral-100"
                >
                  <Text className="font-bold text-black">Clear all</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Vendor pills (only if enough options) */}
            {vendors.length >= 4 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3"
                contentContainerClassName="gap-2.5"
              >
                <Pressable
                  onPress={() => setSelectedVendors([])}
                  className={`py-2.5 px-4 rounded-full ${selectedVendors.length === 0 ? "bg-[#8E1A26]" : "bg-neutral-200"}`}
                >
                  <Text className={`${selectedVendors.length === 0 ? "text-white" : "text-black"} font-bold`}>All</Text>
                </Pressable>
                {vendors.map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setSelectedVendors([v])}
                    className={`py-2.5 px-4 rounded-full ${selectedVendors.includes(v) ? "bg-[#8E1A26]" : "bg-neutral-200"}`}
                  >
                    <Text className={`${selectedVendors.includes(v) ? "text-white" : "text-black"} font-bold`}>
                      {v}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {/* Products */}
          <View className="mt-4">
            {filtered.length === 0 ? (
              <View className="items-center py-10">
                <Text className="text-black font-bold text-lg mb-1.5">No products found</Text>
                <Text className="text-gray-500">Try adjusting filters or search.</Text>
              </View>
            ) : null}
            <StaticProductGrid
              data={filtered}
              columns={view}
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
                  padding={view === 2 ? "sm" : "md"}
                  onPress={() => {
                    const h = item?.handle
                    if (h) router.push(`/products/${h}` as any)
                  }}
                />
              )}
            />

            {/* Infinite loading skeletons */}
            {isFetchingNextPage ? (
              <View className="mt-3">
                {view === 2 ? (
                  <View className="flex-row">
                    <Skeleton className="flex-1 " style={{ aspectRatio: 3 / 4 }} />
                    <Skeleton className="flex-1 " style={{ aspectRatio: 3 / 4 }} />
                  </View>
                ) : (
                  <View>
                    <Skeleton className="" style={{ aspectRatio: 3 / 4 }} />
                  </View>
                )}
              </View>
            ) : reachedCap ? (
              <View className="py-6 items-center">
                <Text className="text-gray-500">You’ve reached the end</Text>
              </View>
            ) : null}
          </View>
        </PageScrollView>
      </View>
    </Screen>
  )
}
