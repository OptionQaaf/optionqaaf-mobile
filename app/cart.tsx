import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import {
  useAttachCartToCustomer,
  useCartQuery,
  useEnsureCart,
  useSyncCartChanges,
  useUpdateDiscountCodes,
} from "@/features/cart/api"
import { convertAmount } from "@/features/currency/rates"
import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { usePrefs } from "@/store/prefs"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { defaultKeyboardShouldPersistTaps, verticalScrollProps } from "@/ui/layout/scrollDefaults"
import { Animated, MOTION } from "@/ui/motion/motion"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Price } from "@/ui/product/Price"
import { QuantityStepper } from "@/ui/product/QuantityStepper"
import { Card } from "@/ui/surfaces/Card"
import { BlurView } from "expo-blur"
import { Image } from "expo-image"
import { router } from "expo-router"
import { Trash2, X } from "lucide-react-native"
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, FlatList, KeyboardAvoidingView, PixelRatio, Platform, Text, View } from "react-native"
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
  const { isAuthenticated, initializing: authInitializing, login, getToken } = useShopifyAuth()
  const [loginPending, setLoginPending] = useState(false)
  const { mutateAsync: attachBuyerToCustomer, isPending: attachingBuyer } = useAttachCartToCustomer()
  const [buyerLinked, setBuyerLinked] = useState(false)

  // Ensure there is a cart as early as possible (for codes, etc.)
  const ensure = useEnsureCart()
  useEffect(() => {
    if (!ensure.isPending && !ensure.isSuccess) ensure.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: cart, isLoading, isFetching, isError, refetch } = useCartQuery()
  const sync = useSyncCartChanges()
  const { mutateAsync: updateDiscountCodesAsync, isPending: updatingDiscounts } = useUpdateDiscountCodes()
  const [codeInput, setCodeInput] = useState("")

  useEffect(() => {
    if (authInitializing) return
    if (!isAuthenticated) {
      setBuyerLinked(false)
      return
    }
    if (!cart?.id) return
    if (cart?.buyerIdentity?.customer?.id) {
      setBuyerLinked(true)
      return
    }
    if (attachingBuyer || buyerLinked) return

    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (!token || cancelled) return
      try {
        await attachBuyerToCustomer({ customerAccessToken: token })
        if (!cancelled) setBuyerLinked(true)
      } catch (err: any) {
        if (!cancelled) {
          show({ title: err?.message || "Could not link your account to this cart.", type: "danger" })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    attachingBuyer,
    attachBuyerToCustomer,
    authInitializing,
    buyerLinked,
    cart?.buyerIdentity?.customer?.id,
    cart?.id,
    getToken,
    isAuthenticated,
    show,
  ])

  const promptLogin = useCallback(async () => {
    if (loginPending) return false
    setLoginPending(true)
    let success = false
    try {
      await login()
      success = true
    } catch (err: any) {
      const message = err?.message
      if (message && message !== "Login cancelled/failed") {
        show({ title: message, type: "danger" })
      }
    } finally {
      setLoginPending(false)
    }
    return success
  }, [login, loginPending, show])

  const discountCodes = useMemo(() => {
    const raw = (cart?.discountCodes ?? []) as { code?: string | null; applicable?: boolean | null }[]
    return raw
      .filter((d) => typeof d?.code === "string" && Boolean(d.code?.trim().length))
      .map((d) => ({ code: (d.code as string).trim(), applicable: d.applicable ?? null }))
  }, [cart?.discountCodes])

  const handleApplyDiscount = useCallback(async () => {
    const input = codeInput.trim()
    if (!input) return
    const normalized = input.toUpperCase()
    const existing = discountCodes.map((d) => d.code)
    const alreadyApplied = existing.some((c) => c.toUpperCase() === normalized)
    if (alreadyApplied) {
      show({ title: "Code already applied", type: "info" })
      setCodeInput("")
      return
    }
    try {
      await updateDiscountCodesAsync([...existing, normalized])
      setCodeInput("")
      show({ title: "Discount applied", type: "success" })
    } catch (err: any) {
      show({ title: err?.message || "Could not apply that code", type: "danger" })
    }
  }, [codeInput, discountCodes, show, updateDiscountCodesAsync])

  const handleRemoveDiscount = useCallback(
    async (code: string) => {
      const existing = discountCodes.map((d) => d.code)
      const next = existing.filter((c) => c.toUpperCase() !== code.toUpperCase())
      try {
        await updateDiscountCodesAsync(next)
        show({ title: "Discount removed", type: "info" })
      } catch (err: any) {
        show({ title: err?.message || "Could not remove that code", type: "danger" })
      }
    },
    [discountCodes, show, updateDiscountCodesAsync],
  )

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
    const nodes = dedupeLines(((cart?.lines?.nodes ?? []) as LineNode[]).filter(Boolean) as LineNode[])
    const hasPending = pendingRemoves.current.size > 0 || pendingUpdates.current.size > 0
    if (awaitingRefresh.current) awaitingRefresh.current = false

    if (hasPending) {
      const removeSet = new Set(pendingRemoves.current)
      const updateMap = new Map(pendingUpdates.current)
      const merged = nodes
        .filter((l) => !removeSet.has(l.id))
        .map((l) => (updateMap.has(l.id) ? { ...l, quantity: updateMap.get(l.id)! } : l))
      setLocalLines(dedupeLines(merged))
      return
    }
    // No pending → adopt server unless user is mid-edit "dirty"
    if (!dirty) {
      setLocalLines(nodes)
    } else if (!isFetching) {
      setDirty(false)
    }
  }, [cart, dirty, isFetching])

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
  const { subBefore, subAfter, discount, total, tax, hasItems } = useMemo(() => {
    const serverTotal = n(cart?.cost?.totalAmount?.amount, NaN)
    const taxAmount = n(cart?.cost?.totalTaxAmount?.amount, 0)

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
      tax: taxAmount,
      hasItems: itemCount > 0,
    }
  }, [cart, dirty, localLines])

  // Handlers
  const onCheckout = useCallback(async () => {
    if (!hasItems || attachingBuyer) return

    if (isAuthenticated && !cart?.buyerIdentity?.customer?.id) {
      const token = await getToken()
      if (token) {
        try {
          await attachBuyerToCustomer({ customerAccessToken: token })
          setBuyerLinked(true)
        } catch (err: any) {
          show({ title: err?.message || "Could not link your account to this cart.", type: "danger" })
          return
        }
      }
    }

    await flush()
    const url = cart?.checkoutUrl
    if (!url) {
      Alert.alert("Checkout unavailable", "Missing checkout URL")
      return
    }

    router.push({ pathname: "/checkout", params: { url, cartId: cart?.id ?? "" } } as any)
  }, [
    attachingBuyer,
    attachBuyerToCustomer,
    cart?.buyerIdentity?.customer?.id,
    cart?.checkoutUrl,
    cart?.id,
    flush,
    getToken,
    hasItems,
    isAuthenticated,
    show,
  ])

  const onDelete = useCallback(
    (lineId: string) => {
      pendingRemoves.current.add(lineId)
      pendingUpdates.current.delete(lineId)
      setLocalLines((prev) => dedupeLines(prev.filter((l) => l.id !== lineId)))
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
        setLocalLines((prev) => dedupeLines(prev.filter((l) => l.id !== lineId)))
      } else {
        pendingRemoves.current.delete(lineId)
        pendingUpdates.current.set(lineId, q)
        setLocalLines((prev) =>
          dedupeLines(prev.map((l) => (l.id === lineId ? { ...l, quantity: q, cost: undefined } : l))),
        )
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
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: "height" })}
        style={{ flex: 1 }}
        keyboardVerticalOffset={(insets?.top ?? 0) + 72}
      >
        {!authInitializing && !isAuthenticated ? (
          <View className="px-4 pt-4">
            <Card padding="md" className="gap-3">
              <View className="gap-1">
                <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Sign in for faster checkout</Text>
                <Text className="text-[#475569] text-[13px] leading-[18px]">
                  We’ll save your addresses and keep this cart synced across devices.
                </Text>
              </View>
              <Button variant="outline" size="md" fullWidth onPress={promptLogin} isLoading={loginPending}>
                Sign in
              </Button>
            </Card>
          </View>
        ) : null}

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
            <KeyboardAvoidingView
              behavior={Platform.select({ ios: "padding", android: "height" })}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
              keyboardVerticalOffset={(insets?.top ?? 0) + 32}
            >
              <View style={{ backgroundColor: "#fff" }}>
                <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#fff" }}>
                  <View
                    onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
                    className="px-4 py-3 border-t border-border"
                    style={{ backgroundColor: "#fff" }}
                  >
                    <View className="p-3 border border-border rounded-2xl bg-surface gap-2">
                      <View className="gap-2">
                        {discountCodes.length > 0 ? (
                          <View className="gap-2">
                            {discountCodes.map((code) => (
                              <View
                                key={code.code}
                                className="flex-row items-center justify-between rounded-xl border border-border bg-[#f8fafc] px-3 py-2"
                              >
                                <View className="flex-1 pr-3 gap-[2px]">
                                  <Text className="text-[#0f172a] font-geist-semibold text-[14px]">{code.code}</Text>
                                  {code.applicable === false ? (
                                    <Text className="text-[#dc2626] text-[11px]">Not applicable</Text>
                                  ) : null}
                                </View>
                                <PressableOverlay
                                  onPress={() => handleRemoveDiscount(code.code)}
                                  disabled={updatingDiscounts}
                                  className="h-8 w-8 items-center justify-center rounded-full"
                                  accessibilityLabel={`Remove discount ${code.code}`}
                                >
                                  <X size={16} color="#475569" />
                                </PressableOverlay>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        <View className="flex-row items-center gap-3">
                          <Input
                            value={codeInput}
                            onChangeText={setCodeInput}
                            placeholder="Add promo code"
                            autoCapitalize="characters"
                            autoCorrect={false}
                            size="md"
                            className="flex-1"
                            returnKeyType="done"
                          />
                          <Button
                            variant="outline"
                            size="md"
                            onPress={handleApplyDiscount}
                            disabled={updatingDiscounts || !codeInput.trim()}
                            isLoading={updatingDiscounts}
                          >
                            Apply
                          </Button>
                        </View>
                      </View>

                      {(() => {
                        const showUSD = prefCurrency !== "USD"
                        const subDisp = convertAmount(subBefore, currency, prefCurrency)
                        const subUSD = convertAmount(subBefore, currency, "USD")
                        const discDisp = convertAmount(discount, currency, prefCurrency)
                        const discUSD = convertAmount(discount, currency, "USD")
                        const taxDisp = convertAmount(tax, currency, prefCurrency)
                        const taxUSD = convertAmount(tax, currency, "USD")
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
                            {tax > 0 ? (
                              <Row label="Taxes">
                                <DualAmount
                                  main={formatCurrencyText(taxDisp, prefCurrency)}
                                  alt={showUSD ? formatCurrencyText(taxUSD, "USD") : undefined}
                                />
                              </Row>
                            ) : null}
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

                      <Button
                        size="lg"
                        fullWidth
                        onPress={onCheckout}
                        isLoading={attachingBuyer}
                        disabled={!hasItems || attachingBuyer}
                        className="mt-3 bg-neutral-900"
                      >
                        Checkout
                      </Button>
                    </View>
                  </View>
                </SafeAreaView>
              </View>
            </KeyboardAvoidingView>
          </>
        ) : null}
      </KeyboardAvoidingView>
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
    const [base, fragment] = url.split("#", 2)
    const hasQuery = base.includes("?")
    const encoded = encodeURIComponent(value)
    const pattern = new RegExp(`([?&])${key}=[^&]*`)
    let nextBase = base
    if (pattern.test(base)) {
      nextBase = base.replace(pattern, `$1${key}=${encoded}`)
    } else {
      nextBase = `${base}${hasQuery ? "&" : "?"}${key}=${encoded}`
    }
    return fragment !== undefined ? `${nextBase}#${fragment}` : nextBase
  }
}

function dedupeLines(list: LineNode[]): LineNode[] {
  const seen = new Map<string, LineNode>()
  for (const line of list) {
    if (!line || typeof line.id !== "string" || !line.id) continue
    const existing = seen.get(line.id)
    seen.set(line.id, existing ? { ...existing, ...line } : line)
  }
  return Array.from(seen.values())
}
