import { useCartQuery, useEnsureCart, useSyncCartChanges, useUpdateDiscountCodes } from "@/features/cart/api"
import { useCustomerSession } from "@/lib/shopify/customer/hooks"
import { convertAmount } from "@/features/currency/rates"
import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { usePrefs } from "@/store/prefs"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { defaultKeyboardShouldPersistTaps, verticalScrollProps } from "@/ui/layout/scrollDefaults"
import { Animated, MOTION } from "@/ui/motion/motion"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Price } from "@/ui/product/Price"
import { QuantityStepper } from "@/ui/product/QuantityStepper"
import { BlurView } from "expo-blur"
import { Image } from "expo-image"
import { router } from "expo-router"
import { Trash2 } from "lucide-react-native"
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, FlatList, PixelRatio, Platform, Text, View } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

/** ──────────────────────────────────────────────────────────────
 * Cart Screen (calm, compact, resilient)
 * - Pull-to-refresh
 * - Loading & error & empty states
 * - Sticky summary (subtotal/discount/total) with local/dirty fallback
 * - Optimistic batched line updates (no flicker)
 * - A11y labels + steadier image sizing
 * ───────────────────────────────────────────────────────────── */

export default function CartScreen() {
  const insets = useSafeAreaInsets()
  const { currency: prefCurrencyState } = usePrefs()
  const { show } = useToast()
  const { status: customerStatus } = useCustomerSession()

  // Ensure there is a cart as early as possible (for codes, etc.)
  const ensure = useEnsureCart()
  useEffect(() => {
    if (!ensure.isPending && !ensure.isSuccess) ensure.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: cart, isLoading, isFetching, isError, refetch } = useCartQuery()
  const sync = useSyncCartChanges()
  const updateCodes = useUpdateDiscountCodes()

  // Local model for snappy UX
  const [localLines, setLocalLines] = useState<LineNode[]>([])
  const [dirty, setDirty] = useState(false)
  const pendingUpdates = useRef<Map<string, number>>(new Map())
  const pendingRemoves = useRef<Set<string>>(new Set())
  const awaitingRefresh = useRef(false)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSync = useCallback((delay = 700) => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => void flush(), delay)
  }, [])

  const flush = useCallback(async () => {
    if (sync.isPending) return
    const removes = Array.from(pendingRemoves.current)
    const updates = Array.from(pendingUpdates.current.entries())
      .filter(([id]) => !pendingRemoves.current.has(id))
      .map(([id, quantity]) => ({ id, quantity }))
      .filter((u) => u.quantity >= 1)

    if (!removes.length && !updates.length) return
    try {
      awaitingRefresh.current = true
      await sync.mutateAsync({ removes, updates })
      removes.forEach((id) => pendingRemoves.current.delete(id))
      updates.forEach((u) => pendingUpdates.current.delete(u.id))
      if (pendingRemoves.current.size || pendingUpdates.current.size) scheduleSync(200)
    } catch (e: any) {
      show({ title: e?.message || "Failed to update cart", type: "danger" })
    }
  }, [scheduleSync, show, sync])

  // Adopt server snapshot or merge with pending edits
  useEffect(() => {
    const nodes = (cart?.lines?.nodes ?? []) as LineNode[]
    const hasPending = pendingRemoves.current.size > 0 || pendingUpdates.current.size > 0
    if (awaitingRefresh.current) awaitingRefresh.current = false

    if (hasPending) {
      const removeSet = new Set(pendingRemoves.current)
      const updateMap = new Map(pendingUpdates.current)
      const merged = nodes
        .filter((l) => !removeSet.has(l.id))
        .map((l) => (updateMap.has(l.id) ? { ...l, quantity: updateMap.get(l.id)! } : l))
      setLocalLines(merged)
      setDirty(true)
      return
    }
    // No pending → adopt server unless user is mid-edit "dirty"
    if (!dirty) setLocalLines(nodes)
  }, [cart, dirty])

  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current)
    }
  }, [])

  // Currency + numbers
  const currency = String(cart?.cost?.totalAmount?.currencyCode ?? "USD").toUpperCase()
  const prefCurrency = String(prefCurrencyState || currency || "USD").toUpperCase()

  // Derived money (compact & consistent)
  // Derived money (compact & consistent)
  const { subBefore, subAfter, discount, total, hasItems } = useMemo(() => {
    const serverTotal = n(cart?.cost?.totalAmount?.amount, NaN)

    let subBeforeDiscounts = 0 // compareAt × qty
    let subAfterDiscounts = 0 // actual line cost (or unit price) × qty
    let itemCount = 0

    for (const line of localLines) {
      const quantity = n(line?.quantity, 0)
      const unitPrice = n(line?.merchandise?.price?.amount)
      const compareAt = n(line?.merchandise?.compareAtPrice?.amount ?? unitPrice)
      const lineCost = n(line?.cost?.subtotalAmount?.amount, NaN)

      itemCount += quantity
      subBeforeDiscounts += compareAt * quantity
      subAfterDiscounts += Number.isFinite(lineCost) ? lineCost : unitPrice * quantity
    }

    const resolvedTotal = dirty ? subAfterDiscounts : Number.isFinite(serverTotal) ? serverTotal : subAfterDiscounts

    const savings = Math.max(0, subBeforeDiscounts - subAfterDiscounts)

    return {
      subBefore: subBeforeDiscounts,
      subAfter: subAfterDiscounts,
      discount: savings,
      total: resolvedTotal,
      hasItems: itemCount > 0,
    }
  }, [cart, dirty, localLines])

  // Handlers
  const onCheckout = useCallback(async () => {
    await flush()
    const url = cart?.checkoutUrl
    if (!url) return Alert.alert("Checkout unavailable", "Missing checkout URL")
    const finalUrl = customerStatus === "authenticated" ? setQueryParam(url, "logged_in", "true") : url
    router.push({ pathname: "/checkout", params: { url: finalUrl } } as any)
  }, [cart?.checkoutUrl, customerStatus, flush])

  const onDelete = useCallback(
    (lineId: string) => {
      pendingRemoves.current.add(lineId)
      pendingUpdates.current.delete(lineId)
      setLocalLines((prev) => prev.filter((l) => l.id !== lineId))
      setDirty(true)
      scheduleSync()
    },
    [scheduleSync],
  )

  const onChangeQty = useCallback(
    (lineId: string, q: number) => {
      if (q <= 0) {
        pendingRemoves.current.add(lineId)
        pendingUpdates.current.delete(lineId)
        setLocalLines((prev) => prev.filter((l) => l.id !== lineId))
      } else {
        pendingRemoves.current.delete(lineId)
        pendingUpdates.current.set(lineId, q)
        setLocalLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, quantity: q, cost: undefined } : l)))
      }
      setDirty(true)
      scheduleSync()
    },
    [scheduleSync],
  )

  // Item component (memoized)
  const LineItem = useMemo(
    () =>
      memo(function LineItem({ item }: { item: LineNode }) {
        const variant = item?.merchandise
        const product = variant?.product
        const qty = n(item?.quantity, 1)
        const unitPrice = n(variant?.price?.amount)
        const imageUrl = variant?.image?.url || product?.featuredImage?.url || ""
        const handle = product?.handle as string | undefined

        const goToPDP = useCallback(() => {
          if (!handle) return
          router.push({ pathname: "/products/[handle]", params: { handle } } as any)
        }, [handle])

        const opts = (variant?.selectedOptions ?? []) as { name: string; value: string }[]
        const optionsText = opts
          .filter((o) => o?.value && o?.name)
          .map((o) => `${o.name}: ${o.value}`)
          .join("  ·  ")

        return (
          <Animated.View
            entering={MOTION.enter.fadeDown}
            exiting={MOTION.exit.fadeUp}
            layout={MOTION.spring()}
            className="flex-row gap-3 p-3 mb-3 rounded-2xl bg-surface border border-border"
            accessibilityRole="summary"
          >
            <PressableOverlay
              onPress={goToPDP}
              className="rounded-2xl overflow-hidden"
              accessibilityLabel="Open product"
            >
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
                style={{ width: 84, height: 84, borderRadius: 16 }}
                cachePolicy="disk"
                transition={120}
                placeholder={DEFAULT_PLACEHOLDER}
              />
            </PressableOverlay>

            <View className="flex-1 min-w-0">
              {/* Title + delete */}
              <View className="flex-row items-start">
                <View className="flex-1 min-w-0 pr-2">
                  <PressableOverlay onPress={goToPDP} className="active:opacity-90">
                    <Text className="text-primary font-geist-semibold text-[16px]" numberOfLines={1}>
                      {product?.title ?? "Product"}
                    </Text>
                  </PressableOverlay>
                  {optionsText ? (
                    <Text className="text-secondary text-[12px] mt-1" numberOfLines={1}>
                      {optionsText}
                    </Text>
                  ) : null}
                </View>
                <PressableOverlay
                  accessibilityLabel="Remove from cart"
                  onPress={() => onDelete(item.id)}
                  className="w-9 h-9 rounded-full items-center justify-center"
                >
                  <Trash2 size={18} color="#8a8a8a" />
                </PressableOverlay>
              </View>

              {/* Price + Qty */}
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-1 min-w-0 pr-3">
                  <Price amount={unitPrice} currency={String(variant?.price?.currencyCode ?? currency)} />
                </View>
                <View className="px-2 py-1 rounded-full bg-surface border border-border">
                  <QuantityStepper value={qty} onChange={(q) => onChangeQty(item.id, q)} />
                </View>
              </View>
            </View>
          </Animated.View>
        )
      }),
    [currency, onChangeQty, onDelete],
  )

  // Footer sizing
  const [footerH, setFooterH] = useState(220)
  const listBottomPad = Math.max(footerH + (insets?.bottom ?? 0) + 16, 24)

  // Currency display helper
  const formatCurrencyText = useMemo(
    () => (v: number, cur: string) => {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: (cur || "USD").toUpperCase(),
          maximumFractionDigits: 2,
        }).format(v)
      } catch {
        return `${v.toFixed(2)} ${(cur || "USD").toUpperCase()}`
      }
    },
    [],
  )

  // States
  const loadingState = (isLoading && !cart) || ensure.isPending
  const errorState = isError && !cart

  return (
    <Screen bleedBottom>
      <MenuBar />

      {/* Error */}
      {errorState ? (
        <CenteredState
          title="Something went wrong"
          body="Please try again."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : null}

      {/* Initial loading */}
      {loadingState ? <SkeletonList /> : null}

      {/* Content */}
      {!loadingState && !errorState ? (
        <>
          <FlatList
            {...verticalScrollProps}
            data={localLines}
            keyExtractor={(l) => l.id}
            renderItem={({ item }) => <LineItem item={item} />}
            extraData={localLines.length}
            ListEmptyComponent={<EmptyCart />}
            contentContainerStyle={{ padding: 16, paddingBottom: listBottomPad }}
            keyboardShouldPersistTaps={defaultKeyboardShouldPersistTaps}
            scrollIndicatorInsets={{ bottom: listBottomPad }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={8}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            maxToRenderPerBatch={10}
          />

          {/* Floating sync pill */}
          {sync.isPending ? <SyncPill /> : null}

          {/* Sticky summary */}
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff" }}>
            <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#fff" }}>
              <View
                onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
                className="px-4 py-3 border-t border-border"
                style={{ backgroundColor: "#fff" }}
              >
                <View className="p-3 border border-border rounded-2xl bg-surface gap-2">
                  {(() => {
                    const showUSD = prefCurrency !== "USD"
                    const subDisp = convertAmount(subBefore, currency, prefCurrency)
                    const subUSD = convertAmount(subBefore, currency, "USD")
                    const discDisp = convertAmount(discount, currency, prefCurrency)
                    const discUSD = convertAmount(discount, currency, "USD")
                    const totDisp = convertAmount(total, currency, prefCurrency)
                    const totUSD = convertAmount(total, currency, "USD")
                    return (
                      <>
                        <Row label="Subtotal">
                          <DualAmount
                            main={formatCurrencyText(subDisp, prefCurrency)}
                            alt={showUSD ? formatCurrencyText(subUSD, "USD") : undefined}
                          />
                        </Row>
                        {discount > 0 ? (
                          <Row label="Discounts">
                            <DualAmount
                              main={`-${formatCurrencyText(discDisp, prefCurrency)}`}
                              alt={showUSD ? `-${formatCurrencyText(discUSD, "USD")}` : undefined}
                              tone="danger"
                            />
                          </Row>
                        ) : null}
                        <Divider />
                        <Row label="Total">
                          <DualAmount
                            main={formatCurrencyText(totDisp, prefCurrency)}
                            alt={showUSD ? formatCurrencyText(totUSD, "USD") : undefined}
                            emphasize
                          />
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
        </>
      ) : null}
    </Screen>
  )
}

/** ────────────────────────────
 * Subcomponents (compact)
 * ──────────────────────────── */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-secondary">{label}</Text>
      {children}
    </View>
  )
}

function DualAmount({
  main,
  alt,
  tone,
  emphasize,
}: {
  main: string
  alt?: string
  tone?: "danger"
  emphasize?: boolean
}) {
  return (
    <View className="flex-row items-baseline gap-2">
      <Text
        className={[
          emphasize ? "text-[18px] font-geist-bold text-primary" : "text-primary",
          tone === "danger" ? "!text-danger font-geist-medium" : "",
        ].join(" ")}
      >
        {main}
      </Text>
      {alt ? <Text className="text-secondary text-[12px]">({alt})</Text> : null}
    </View>
  )
}

function Divider() {
  return <View className="h-[1px] bg-border my-2" />
}

function SyncPill() {
  return (
    <Animated.View
      entering={MOTION.enter.fade}
      exiting={MOTION.exit.fade}
      style={{ position: "absolute", left: 0, right: 0, bottom: 220, alignItems: "center", zIndex: 10 }}
      accessible
      accessibilityLiveRegion="polite"
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
  )
}

function EmptyCart() {
  return (
    <View className="px-5 py-16 items-center gap-2">
      <Text className="text-primary text-[18px] font-geist-semibold">Your cart is empty</Text>
      <Text className="text-secondary mb-3">Find something you love.</Text>
      <PressableOverlay onPress={() => router.push("/home" as any)} className="px-4 py-2 rounded-full bg-brand">
        <Text className="text-white font-geist-semibold">Continue shopping</Text>
      </PressableOverlay>
    </View>
  )
}

function CenteredState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <View className="flex-1 px-6 items-center justify-center">
      <Text className="text-primary text-[18px] font-geist-semibold">{title}</Text>
      {body ? <Text className="text-secondary mt-1 text-center">{body}</Text> : null}
      {actionLabel && onAction ? (
        <PressableOverlay onPress={onAction} className="mt-4 px-4 py-2 rounded-full bg-neutral-900">
          <Text className="text-white font-geist-semibold">{actionLabel}</Text>
        </PressableOverlay>
      ) : null}
    </View>
  )
}

function SkeletonList() {
  return (
    <View className="px-4 pt-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} className="flex-row gap-3 p-3 mb-3 rounded-2xl bg-surface border border-border">
          <View className="w-[84px] h-[84px] rounded-2xl bg-elev animate-pulse" />
          <View className="flex-1 gap-2">
            <View className="h-4 w-2/3 rounded bg-elev animate-pulse" />
            <View className="h-3 w-1/2 rounded bg-elev animate-pulse" />
            <View className="h-8 w-full rounded-full bg-elev mt-2 animate-pulse" />
          </View>
        </View>
      ))}
    </View>
  )
}

/** ────────────────────────────
 * Types + utils
 * ──────────────────────────── */

type LineNode = {
  id: string
  quantity: number
  merchandise?: {
    price?: { amount?: number | string; currencyCode?: string }
    compareAtPrice?: { amount?: number | string }
    image?: { url?: string }
    title?: string
    selectedOptions?: { name: string; value: string }[]
    product?: {
      title?: string
      handle?: string
      featuredImage?: { url?: string }
    }
  }
  cost?: {
    subtotalAmount?: { amount?: number | string; currencyCode?: string }
  }
}

function n(x: unknown, fallback = 0): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : fallback
}

function setQueryParam(url: string, key: string, value: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set(key, value)
    return parsed.toString()
  } catch {
    const hasQuery = url.includes("?")
    const encoded = encodeURIComponent(value)
    const pattern = new RegExp(`([?&])${key}=[^&]*`)
    if (pattern.test(url)) {
      return url.replace(pattern, `$1${key}=${encoded}`)
    }
    return `${url}${hasQuery ? "&" : "?"}${key}=${encoded}`
  }
}
