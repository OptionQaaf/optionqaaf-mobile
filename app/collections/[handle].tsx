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
import { Check, ChevronLeft, ChevronRight, Filter, LayoutGrid, Search, Square, X } from "lucide-react-native"
import React, { useEffect, useMemo, useState } from "react"
import {
  Animated,
  ImageBackground,
  KeyboardAvoidingView,
  LayoutAnimation,
  LayoutChangeEvent,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native"

// Optional gradient for hero overlay
let LinearGradient: any
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  const specialSections = useMemo(() => specialHome?.sections ?? [], [specialHome?.sections])
  const specialCapsuleHandles = useMemo(() => {
    const handles: string[] = []
    for (const section of specialSections ?? []) {
      if (section?.kind === "product_rail" && section.collectionHandle) {
        if (!handles.includes(section.collectionHandle)) handles.push(section.collectionHandle)
      }
    }
    return handles.slice(0, 3)
  }, [specialSections])
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
  const [pendingFilterAnimation, setPendingFilterAnimation] = useState(false)
  const [sort, setSort] = useState<"featured" | "priceAsc" | "priceDesc">("featured")
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [onSaleOnly, setOnSaleOnly] = useState(false)
  const [filterScreen, setFilterScreen] = useState<"main" | "brand">("main")
  const [brandSearch, setBrandSearch] = useState("")
  const sheetProgress = React.useRef(new Animated.Value(0)).current
  const sheetHeightRef = React.useRef(0)
  const [sheetHeight, setSheetHeight] = useState(0)
  const DEFAULT_SHEET_OFFSET = 520
  const hiddenOffset = (sheetHeight || sheetHeightRef.current || DEFAULT_SHEET_OFFSET) + 32
  const animateFilterIn = React.useCallback(() => {
    sheetProgress.stopAnimation((current) => {
      const start = Math.min(1, Math.max(0, Number.isFinite(current) ? current : 0))
      sheetProgress.setValue(start)
      Animated.timing(sheetProgress, {
        toValue: 1,
        duration: Math.max(1, Math.round((1 - start) * 220)),
        useNativeDriver: true,
      }).start()
    })
  }, [sheetProgress])
  const animateFilterOut = React.useCallback(() => {
    sheetProgress.stopAnimation((current) => {
      const start = Math.min(1, Math.max(0, Number.isFinite(current) ? current : 0))
      sheetProgress.setValue(start)
      Animated.timing(sheetProgress, {
        toValue: 0,
        duration: Math.max(1, Math.round(start * 220)),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShowFilters(false)
          sheetProgress.setValue(0)
        }
      })
    })
  }, [sheetProgress])
  const openFilters = React.useCallback(() => {
    if (showFilters) {
      animateFilterIn()
      return
    }
    sheetProgress.setValue(0)
    setPendingFilterAnimation(true)
    setFilterScreen("main")
    setBrandSearch("")
    setShowFilters(true)
  }, [animateFilterIn, sheetProgress, showFilters])
  const closeFilters = React.useCallback(() => {
    if (!showFilters) return
    setPendingFilterAnimation(false)
    setFilterScreen("main")
    setBrandSearch("")
    animateFilterOut()
  }, [animateFilterOut, showFilters])

  useEffect(() => {
    if (!showFilters) {
      setPendingFilterAnimation(false)
      sheetProgress.setValue(0)
    }
  }, [showFilters, sheetProgress])

  const handleFilterSheetLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event?.nativeEvent?.layout?.height ?? 0)
    if (!nextHeight || nextHeight === sheetHeightRef.current) return
    sheetHeightRef.current = nextHeight
    setSheetHeight(nextHeight)
  }, [])

  const handleFilterModalShow = React.useCallback(() => {
    if (!pendingFilterAnimation) return
    setPendingFilterAnimation(false)
    animateFilterIn()
  }, [animateFilterIn, pendingFilterAnimation])

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
      if (onSaleOnly) {
        const compare = Number(p?.compareAtPriceRange?.minVariantPrice?.amount ?? 0)
        if (!(compare > price)) return false
      }
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
  }, [products, query, selectedVendors, sort, minPrice, maxPrice, onSaleOnly])

  const vendorStats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      const vendor = p?.vendor
      if (!vendor) continue
      counts.set(vendor, (counts.get(vendor) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  const filteredVendors = useMemo(() => {
    const q = brandSearch.trim().toLowerCase()
    if (!q) return vendorStats
    return vendorStats.filter((v) => v.name.toLowerCase().includes(q))
  }, [brandSearch, vendorStats])

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
    const sections = specialSections
    const capsuleHandles = specialCapsuleHandles
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
            <Modal
              visible={showFilters}
              animationType="none"
              transparent
              onRequestClose={closeFilters}
              onShow={handleFilterModalShow}
            >
              <View className="flex-1">
                <Animated.View
                  pointerEvents={showFilters ? "auto" : "none"}
                  className="absolute inset-0 bg-[#0B0B0B]/70"
                  style={{
                    opacity: sheetProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  }}
                />
                <Pressable className="absolute inset-0" onPress={closeFilters} />
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : undefined}
                  className="flex-1 justify-end"
                >
                  <Animated.View
                    onLayout={handleFilterSheetLayout}
                    className="bg-white rounded-t-3xl pt-3"
                    style={{
                      transform: [
                        {
                          translateY: sheetProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [hiddenOffset, 0],
                            extrapolate: "clamp",
                          }),
                        },
                      ],
                    }}
                  >
                    <View className="items-center pb-2">
                      <View className="h-1 w-12 rounded-full bg-neutral-200" />
                    </View>
                    <View className="border-b border-neutral-100 px-6 pb-4">
                      <View className="flex-row items-center justify-between">
                        {filterScreen === "brand" ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setFilterScreen("main")}
                            className="h-10 w-10 items-center justify-center rounded-full bg-neutral-100"
                          >
                            <ChevronLeft size={18} color="#0B0B0B" />
                          </Pressable>
                        ) : (
                          <View className="h-10 w-10" />
                        )}
                        <Text className="text-xl font-extrabold text-black">
                          {filterScreen === "brand" ? "Brand" : "Filter"}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={closeFilters}
                          className="h-10 w-10 items-center justify-center rounded-full bg-neutral-100"
                        >
                          <X size={18} color="#0B0B0B" />
                        </Pressable>
                      </View>
                    </View>

                    {filterScreen === "main" ? (
                      <>
                        <ScrollView
                          className="max-h-[70vh]"
                          contentContainerClassName="px-6 pb-6 gap-5"
                          showsVerticalScrollIndicator={false}
                        >
                          <View className="rounded-3xl border border-neutral-100 bg-white px-5 py-4 shadow-sm">
                            <View className="flex-row items-center justify-between">
                              <Text className="text-base font-semibold text-neutral-500">Category</Text>
                              <View className="flex-row items-center gap-2">
                                <Text className="text-base font-semibold text-black opacity-80" numberOfLines={1}>
                                  {title}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <Pressable
                            onPress={() => setFilterScreen("brand")}
                            className="rounded-3xl border border-neutral-100 bg-white px-5 py-4 shadow-sm"
                          >
                            <View className="flex-row items-center justify-between">
                              <View>
                                <Text className="text-base font-semibold text-neutral-500">Brand</Text>
                                <Text className="mt-1 text-base font-bold text-black">
                                  {selectedVendors.length > 0 ? `${selectedVendors.length} selected` : "All brands"}
                                </Text>
                              </View>
                              <ChevronRight size={18} color="#0B0B0B" />
                            </View>
                          </Pressable>

                          <View className="rounded-3xl border border-neutral-100 bg-white px-5 py-4 shadow-sm">
                            <View className="flex-row items-center justify-between">
                              <View>
                                <Text className="text-base font-semibold text-neutral-500">Sale</Text>
                                <Text className="mt-1 text-base font-bold text-black">
                                  {onSaleOnly ? "On sale only" : "Include all"}
                                </Text>
                              </View>
                              <Switch
                                value={onSaleOnly}
                                onValueChange={setOnSaleOnly}
                                trackColor={{ true: "#0B0B0B", false: "#D1D5DB" }}
                                thumbColor="#FFFFFF"
                              />
                            </View>
                          </View>

                          <View className="rounded-3xl border border-neutral-100 bg-white px-5 py-4 shadow-sm">
                            <Text className="text-base font-semibold text-neutral-500">Price</Text>
                            <View className="mt-4">
                              <View className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                                <View className="h-full w-full bg-[#8E1A26]/80" />
                              </View>
                              <View className="mt-4 flex-row gap-3">
                                <View className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                                  <Text className="text-xs font-semibold uppercase text-neutral-400">Min</Text>
                                  <TextInput
                                    value={minPrice}
                                    onChangeText={setMinPrice}
                                    placeholder="0"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                    className="mt-1 text-base font-semibold text-black"
                                  />
                                </View>
                                <View className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                                  <Text className="text-xs font-semibold uppercase text-neutral-400">Max</Text>
                                  <TextInput
                                    value={maxPrice}
                                    onChangeText={setMaxPrice}
                                    placeholder="1000000"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                    className="mt-1 text-base font-semibold text-black"
                                  />
                                </View>
                              </View>
                            </View>
                          </View>

                          <View className="rounded-3xl border border-neutral-100 bg-white px-5 py-4 shadow-sm">
                            <Text className="text-base font-semibold text-neutral-500">Sort by</Text>
                            <View className="mt-3 flex-row flex-wrap gap-3">
                              {(
                                [
                                  { key: "featured", label: "Featured" },
                                  { key: "priceAsc", label: "Price: Low to High" },
                                  { key: "priceDesc", label: "Price: High to Low" },
                                ] as const
                              ).map((opt) => {
                                const active = sort === opt.key
                                return (
                                  <Pressable
                                    key={opt.key}
                                    onPress={() => setSort(opt.key)}
                                    className={`rounded-full border px-4 py-2 ${
                                      active ? "border-[#0B0B0B] bg-[#0B0B0B]" : "border-neutral-200 bg-white"
                                    }`}
                                  >
                                    <Text className={`text-sm font-semibold ${active ? "text-white" : "text-black"}`}>
                                      {opt.label}
                                    </Text>
                                  </Pressable>
                                )
                              })}
                            </View>
                          </View>
                        </ScrollView>
                        <View className="border-t border-neutral-100 px-6 pb-6 pt-4">
                          <View className="flex-row items-center justify-between gap-3">
                            <Pressable
                              onPress={() => {
                                setSelectedVendors([])
                                setMinPrice("")
                                setMaxPrice("")
                                setSort("featured")
                                setQuery("")
                                setOnSaleOnly(false)
                              }}
                              className="flex-1 items-center justify-center rounded-full border border-neutral-200 bg-white py-3"
                            >
                              <Text className="text-base font-semibold text-black">Clear all</Text>
                            </Pressable>
                            <Pressable
                              onPress={closeFilters}
                              className="flex-1 items-center justify-center rounded-full bg-[#0B0B0B] py-3"
                            >
                              <Text className="text-base font-semibold text-white">
                                {filtered.length > 0 ? `Show ${filtered.length.toLocaleString()}` : "Show results"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </>
                    ) : (
                      <>
                        <View className="px-6 pt-4 pb-2">
                          <View className="flex-row items-center gap-3 rounded-full bg-neutral-100 px-4 py-3">
                            <Search size={16} color="#6B7280" />
                            <TextInput
                              value={brandSearch}
                              onChangeText={setBrandSearch}
                              placeholder="Search brand"
                              placeholderTextColor="#9CA3AF"
                              className="flex-1 text-base text-black"
                            />
                          </View>
                        </View>
                        <ScrollView
                          className="max-h-[60vh]"
                          contentContainerClassName="px-6 pb-6"
                          showsVerticalScrollIndicator={false}
                        >
                          {filteredVendors.length === 0 ? (
                            <View className="items-center py-10">
                              <Text className="text-base font-semibold text-neutral-500">No brands found</Text>
                            </View>
                          ) : (
                            filteredVendors.map((vendor) => {
                              const checked = selectedVendors.includes(vendor.name)
                              return (
                                <Pressable
                                  key={vendor.name}
                                  onPress={() => {
                                    setSelectedVendors((prev) =>
                                      prev.includes(vendor.name)
                                        ? prev.filter((v) => v !== vendor.name)
                                        : [...prev, vendor.name],
                                    )
                                  }}
                                  className="flex-row items-center justify-between border-b border-neutral-100 py-4"
                                >
                                  <View className="flex-row items-center gap-4">
                                    <View
                                      className={`h-6 w-6 items-center justify-center rounded-md border ${
                                        checked ? "border-transparent bg-[#0B0B0B]" : "border-neutral-300 bg-white"
                                      }`}
                                    >
                                      {checked ? <Check size={16} color="#FFFFFF" /> : null}
                                    </View>
                                    <Text className="text-base font-semibold text-black">{vendor.name}</Text>
                                  </View>
                                  <Text className="text-sm font-semibold text-neutral-400">{vendor.count}</Text>
                                </Pressable>
                              )
                            })
                          )}
                        </ScrollView>
                        <View className="border-t border-neutral-100 px-6 pb-6 pt-4">
                          <View className="flex-row items-center justify-between gap-3">
                            <Pressable
                              onPress={() => setSelectedVendors([])}
                              className="flex-1 items-center justify-center rounded-full border border-neutral-200 bg-white py-3"
                            >
                              <Text className="text-base font-semibold text-black">Clear</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setFilterScreen("main")}
                              className="flex-1 items-center justify-center rounded-full bg-[#0B0B0B] py-3"
                            >
                              <Text className="text-base font-semibold text-white">
                                {selectedVendors.length > 0 ? `Show ${selectedVendors.length}` : "Apply"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </>
                    )}
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
