import { useCartQuery, useEnsureCart, useSyncCartChanges, useUpdateDiscountCodes } from "@/features/cart/api"
import { convertAmount } from "@/features/currency/rates"
import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { usePrefs } from "@/store/prefs"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { Animated, MOTION } from "@/ui/motion/motion"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Price } from "@/ui/product/Price"
import { QuantityStepper } from "@/ui/product/QuantityStepper"
import { BlurView } from "expo-blur"
import { Image } from "expo-image"
import { router } from "expo-router"
import { Trash2 } from "lucide-react-native"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, FlatList, PixelRatio, Platform, Text, View } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

export default function CartScreen() {
  const insets = useSafeAreaInsets()
  const { currency: prefCurrencyState } = usePrefs()
  // Ensure cart exists so user can paste a code before lines are added
  const ensure = useEnsureCart()
  useEffect(() => {
    if (!ensure.isPending && !ensure.isSuccess) ensure.mutate()
  }, [])

  const { data: cart } = useCartQuery()
  const { show } = useToast()
  // Local cart model managed for snappy UX; sync in batches
  const [localLines, setLocalLines] = useState<any[]>([])
  const [dirty, setDirty] = useState(false)
  const pendingUpdates = useRef<Map<string, number>>(new Map())
  const pendingRemoves = useRef<Set<string>>(new Set())
  const syncTimer = useRef<any>(null)
  const sync = useSyncCartChanges()
  const awaitingRefresh = useRef(false)
  const scheduleSync = (delay = 700) => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      flush()
    }, delay)
  }
  const flush = async () => {
    if (sync.isPending) return
    const removes = Array.from(pendingRemoves.current)
    const updates = Array.from(pendingUpdates.current.entries())
      .filter(([id]) => !pendingRemoves.current.has(id))
      .map(([id, quantity]) => ({ id, quantity }))
      .filter((u) => u.quantity >= 1)
    if (removes.length === 0 && updates.length === 0) return
    try {
      // mark that we're expecting a server refresh; keep local model in place to avoid flicker
      awaitingRefresh.current = true
      await sync.mutateAsync({ removes, updates })
      removes.forEach((id) => pendingRemoves.current.delete(id))
      updates.forEach((u) => pendingUpdates.current.delete(u.id))
      // Don't clear dirty here; wait for cart refetch to land to prevent flicker
      if (pendingRemoves.current.size > 0 || pendingUpdates.current.size > 0) scheduleSync(200)
    } catch (e: any) {
      show({ title: e?.message || "Failed to update cart", type: "danger" })
    }
  }
  // Initialize/refresh local model from server and reconcile with any pending edits
  useEffect(() => {
    const nodes = (cart?.lines?.nodes ?? []) as any[]
    const hasPending = pendingRemoves.current.size > 0 || pendingUpdates.current.size > 0

    // Clear the refresh flag if this update comes after a flush
    if (awaitingRefresh.current) {
      awaitingRefresh.current = false
    }

    if (hasPending) {
      // Merge server snapshot with local pending edits so UI never regresses
      const removeSet = new Set(pendingRemoves.current)
      const updateMap = new Map(pendingUpdates.current)
      const merged = nodes
        .filter((l) => !removeSet.has(l.id))
        .map((l) => (updateMap.has(l.id) ? { ...l, quantity: updateMap.get(l.id) } : l))
      setLocalLines(merged)
      setDirty(true)
      return
    }

    // No pending edits; if not currently editing, adopt server snapshot
    if (!dirty) setLocalLines(nodes)
  }, [cart])
  useEffect(() => () => syncTimer.current && clearTimeout(syncTimer.current), [])
  const updateCodes = useUpdateDiscountCodes()

  const [code, setCode] = useState("")
  const codes = (cart?.discountCodes ?? []).map((c: any) => c.code)

  // Currency first (used below)
  const currency = String(cart?.cost?.totalAmount?.currencyCode ?? "USD")
  // Local lines for calculations
  const lineNodes = localLines
  const derivedPost = lineNodes.reduce(
    (sum, l) => sum + Number(l?.merchandise?.price?.amount ?? 0) * Number(l?.quantity ?? 1),
    0,
  )
  const derivedPre = lineNodes.reduce(
    (sum, l) =>
      sum +
      Number((l?.merchandise?.compareAtPrice?.amount ?? l?.merchandise?.price?.amount ?? 0) as number) *
        Number(l?.quantity ?? 1),
    0,
  )
  const serverSubtotal = Number(cart?.cost?.subtotalAmount?.amount ?? NaN)
  const serverTotal = Number(cart?.cost?.totalAmount?.amount ?? NaN)
  // Subtotal should show BEFORE discounts
  const subtotal = derivedPre
  // Effective subtotal after discounts (for computing discount row)
  const afterDiscountSubtotal = dirty ? derivedPost : Number.isFinite(serverSubtotal) ? serverSubtotal : derivedPost
  // Final total
  const total = dirty ? derivedPost : Number.isFinite(serverTotal) ? serverTotal : derivedPost
  const discount = Math.max(0, subtotal - afterDiscountSubtotal)
  const currencyUpper = currency.toUpperCase()
  const prefCurrency = (prefCurrencyState || currency || "USD").toUpperCase()
  const hasItems = (localLines?.reduce((n, l) => n + Number(l?.quantity ?? 0), 0) ?? 0) > 0

  const onCheckout = async () => {
    await flush()
    const url = cart?.checkoutUrl
    if (!url) return Alert.alert("Checkout unavailable", "Missing checkout URL")
    router.push({ pathname: "/checkout", params: { url } } as any)
  }

  const onDelete = useCallback((lineId: string) => {
    pendingRemoves.current.add(lineId)
    pendingUpdates.current.delete(lineId)
    setLocalLines((prev) => prev.filter((l) => l.id !== lineId))
    setDirty(true)
    scheduleSync()
  }, [])
  const onChangeQty = useCallback((lineId: string, q: number) => {
    if (q <= 0) {
      pendingRemoves.current.add(lineId)
      pendingUpdates.current.delete(lineId)
      setLocalLines((prev) => prev.filter((l) => l.id !== lineId))
    } else {
      pendingRemoves.current.delete(lineId)
      pendingUpdates.current.set(lineId, q)
      setLocalLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, quantity: q } : l)))
    }
    setDirty(true)
    scheduleSync()
  }, [])

  const LineItem = useMemo(
    () =>
      memo(function LineItem({ item }: { item: any }) {
        const line = item
        const variant = line?.merchandise
        const prod = variant?.product
        const unitPrice = Number(variant?.price?.amount ?? 0)
        const qty = Number(line?.quantity ?? 1)
        const lineAmount = unitPrice * qty
        const imageUrl = variant?.image?.url || prod?.featuredImage?.url || undefined
        const variantTitle = variant?.title && variant?.title !== "Default Title" ? variant?.title : undefined
        const selected = (variant?.selectedOptions ?? []) as { name: string; value: string }[]
        const optionsText = selected
          .filter((o) => o?.value && o?.name)
          .map((o) => `${o.name}: ${o.value}`)
          .join("  |  ")
        const handle = prod?.handle as string | undefined
        const goToPDP = useCallback(() => {
          if (!handle) return
          router.push({ pathname: "/products/[handle]", params: { handle } } as any)
        }, [handle])

        return (
          <Animated.View
            entering={MOTION.enter.fadeDown}
            exiting={MOTION.exit.fadeUp}
            layout={MOTION.spring()}
            className="flex-row gap-3 py-3 px-2 justify-between mb-3 rounded-2xl bg-surface border border-border max-h-[120px]"
          >
            <PressableOverlay onPress={goToPDP} className="rounded-2xl overflow-hidden">
              <Image
                source={
                  imageUrl
                    ? {
                        uri:
                          optimizeImageUrl(imageUrl, {
                            width: 168,
                            height: 120,
                            format: "webp",
                            dpr: Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1)),
                          }) || imageUrl,
                      }
                    : undefined
                }
                contentFit="cover"
                className="bg-neutral-100"
                style={{ width: 84, height: "100%" }}
                cachePolicy="disk"
                transition={150}
                placeholder={DEFAULT_PLACEHOLDER}
              />
            </PressableOverlay>
            <View className="flex-1 min-w-0">
              {/* Title + Trash */}
              <View className="flex-row items-start">
                <View className="flex-1 min-w-0 pr-2">
                  <PressableOverlay onPress={goToPDP} className="active:opacity-90">
                    <Text className="text-primary font-geist-semibold text-[16px]" numberOfLines={1}>
                      {prod?.title ?? "Product"}
                    </Text>
                  </PressableOverlay>
                </View>
                <PressableOverlay
                  onPress={() => onDelete(line.id)}
                  className="w-9 h-9 rounded-full items-center justify-center"
                >
                  <Trash2 size={18} color="#8a8a8a" />
                </PressableOverlay>
              </View>

              {/* Options */}
              {optionsText ? (
                <Text className="text-secondary text-[12px] mt-1" numberOfLines={1}>
                  {optionsText}
                </Text>
              ) : null}

              {/* Price + Qty pill on the same line */}
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-1 min-w-0 pr-3">
                  <Price amount={unitPrice} currency={String(variant?.price?.currencyCode ?? currency)} />
                </View>
                <View className="px-2 py-1 rounded-full bg-surface border border-border">
                  <QuantityStepper value={qty} onChange={(q) => onChangeQty(line.id, q)} />
                </View>
              </View>
            </View>
          </Animated.View>
        )
      }),
    [currency, onChangeQty, onDelete],
  )

  const data = localLines as any[]

  // Sticky footer height management
  const [footerH, setFooterH] = useState(220)
  const listBottomPad = Math.max(footerH + (insets?.bottom ?? 0) + 16, 24)

  const formatCurrencyText = useCallback((v: number, cur: string) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (cur || "USD").toUpperCase(),
        maximumFractionDigits: 2,
      }).format(v)
    } catch {
      return `${v.toFixed(2)} ${(cur || "USD").toUpperCase()}`
    }
  }, [])

  return (
    <Screen bleedBottom>
      <MenuBar />
      <FlatList
        data={data}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => <LineItem item={item} />}
        extraData={data.length}
        ListEmptyComponent={
          <View className="px-5 py-12 items-center gap-2">
            <Text className="text-primary text-[18px] font-geist-semibold">Your cart is empty</Text>
            <PressableOverlay onPress={() => router.push("/home" as any)} className="px-4 py-2 rounded-full bg-brand">
              <Text className="text-white font-geist-semibold">Continue shopping</Text>
            </PressableOverlay>
          </View>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: listBottomPad }}
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        maxToRenderPerBatch={10}
      />

      {/* Sticky bottom summary + discounts */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff" }}>
        {/* Floating sync info above summary */}
        {sync.isPending ? (
          <Animated.View
            entering={MOTION.enter.fade}
            exiting={MOTION.exit.fade}
            style={{ position: "absolute", left: 0, right: 0, top: -28, alignItems: "center", zIndex: 10 }}
          >
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 4,
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                overflow: "hidden",
              }}
            >
              <BlurView
                intensity={28}
                tint="light"
                style={{
                  ...Platform.select({
                    ios: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999 },
                    android: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999 },
                  }),
                }}
              />
              <Text
                className="text-muted text-[13px]"
                style={{
                  textAlign: "center",
                  backgroundColor: "rgba(255,255,255,0.28)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                Synchronizing…
              </Text>
            </View>
          </Animated.View>
        ) : null}
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#fff" }}>
          <View
            onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
            className="px-4 py-3 border-t border-border"
            style={{ backgroundColor: "#fff" }}
          >
            {/* Discount code */}
            {/* <View className="p-3 border border-border rounded-2xl bg-surface">
              <Text className="text-primary font-geist-semibold mb-2">Discounts</Text>
              {codes?.length ? <Text className="text-secondary mb-2">Applied: {codes.join(", ")}</Text> : null}
              <View className="flex-row gap-2 items-center">
                <TextInput
                  placeholder="I have a discount code"
                  placeholderTextColor="#8a8a8a"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                  className="flex-1 px-3 py-3 rounded-xl bg-surface border border-border text-primary"
                />
                <PressableOverlay
                  onPress={() => updateCodes.mutate(code ? [code] : [])}
                  className="px-4 py-3 rounded-xl bg-neutral-900"
                >
                  <Text className="text-white font-geist-semibold">Apply</Text>
                </PressableOverlay>
              </View>
            </View> */}

            {/* Summary */}
            <View className="mt-3 p-3 border border-border rounded-2xl bg-surface gap-2">
              {(() => {
                const showUSD = prefCurrency !== "USD"
                const subDisp = convertAmount(subtotal, currencyUpper, prefCurrency)
                const subUSD = convertAmount(subtotal, currencyUpper, "USD")
                const discDisp = convertAmount(discount, currencyUpper, prefCurrency)
                const discUSD = convertAmount(discount, currencyUpper, "USD")
                const totDisp = convertAmount(total, currencyUpper, prefCurrency)
                const totUSD = convertAmount(total, currencyUpper, "USD")
                return (
                  <>
                    <Row label="Subtotal">
                      <View className="flex-row items-baseline gap-2">
                        <Text className="text-primary">{formatCurrencyText(subDisp, prefCurrency)}</Text>
                        {showUSD ? (
                          <Text className="text-secondary text-[12px]">({formatCurrencyText(subUSD, "USD")})</Text>
                        ) : null}
                      </View>
                    </Row>
                    {discount > 0 ? (
                      <Row label="Discounts">
                        <View className="flex-row items-baseline gap-2">
                          <Text className="text-danger font-geist-medium">
                            -{formatCurrencyText(discDisp, prefCurrency)}
                          </Text>
                          {showUSD ? (
                            <Text className="text-secondary text-[12px]">(-{formatCurrencyText(discUSD, "USD")})</Text>
                          ) : null}
                        </View>
                      </Row>
                    ) : null}
                    <View className="h-[1px] bg-border my-2" />
                    <Row label="Total">
                      <View className="flex-row items-baseline gap-2">
                        <Text className="text-primary text-[18px] font-geist-bold">
                          {formatCurrencyText(totDisp, prefCurrency)}
                        </Text>
                        {showUSD ? (
                          <Text className="text-secondary text-[12px]">({formatCurrencyText(totUSD, "USD")})</Text>
                        ) : null}
                      </View>
                    </Row>
                  </>
                )
              })()}

              <PressableOverlay
                onPress={onCheckout}
                disabled={!hasItems}
                className={`mt-3 py-4 rounded-2xl ${hasItems ? "bg-neutral-900" : "bg-neutral-300"}`}
              >
                <Text className="text-center text-white font-geist-semibold text-[16px]">Checkout</Text>
              </PressableOverlay>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Screen>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-secondary">{label}</Text>
      {children}
    </View>
  )
}
