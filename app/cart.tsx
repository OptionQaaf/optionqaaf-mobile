import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import {
  useAttachCartToCustomer,
  useCartQuery,
  useEnsureCart,
  useRemoveLine,
  useReplaceCartDeliveryAddresses,
  useUpdateDiscountCodes,
  useUpdateLine,
} from "@/features/cart/api"
import { convertAmount } from "@/features/currency/rates"
import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { usePrefs } from "@/store/prefs"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { defaultKeyboardShouldPersistTaps, flashListScrollProps } from "@/ui/layout/scrollDefaults"
import { Animated, MOTION } from "@/ui/motion/motion"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Price } from "@/ui/product/Price"
import { QuantityStepper } from "@/ui/product/QuantityStepper"
import { Card } from "@/ui/surfaces/Card"
import { FlashList } from "@shopify/flash-list"
import { Image } from "expo-image"
import { router, useLocalSearchParams } from "expo-router"
import { Trash2, X } from "lucide-react-native"
import * as React from "react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, KeyboardAvoidingView, PixelRatio, Platform, Text, View } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

export default function CartScreen() {
  const insets = useSafeAreaInsets()
  const { currency: prefCurrencyState } = usePrefs()
  const { show } = useToast()
  const params = useLocalSearchParams<{ coupon?: string }>()
  const { isAuthenticated, initializing: authInitializing, login, getToken } = useShopifyAuth()
  const [loginPending, setLoginPending] = useState(false)
  const { mutateAsync: attachBuyerToCustomer, isPending: attachingBuyer } = useAttachCartToCustomer()
  const [buyerLinked, setBuyerLinked] = useState(false)
  const { data: customerProfile, refetch: refetchProfile } = useCustomerProfile({ enabled: isAuthenticated })

  // Ensure cart exists as early as possible (needed for coupon URL param flow)
  const ensure = useEnsureCart()
  useEffect(() => {
    if (!ensure.isPending && !ensure.isSuccess) ensure.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: cart, isLoading, isError, refetch } = useCartQuery()
  const { mutateAsync: updateLineAsync } = useUpdateLine()
  const { mutateAsync: removeLineAsync } = useRemoveLine()
  const { mutateAsync: updateDiscountCodesAsync, isPending: updatingDiscounts } = useUpdateDiscountCodes()
  const { mutateAsync: replaceDeliveryAddresses } = useReplaceCartDeliveryAddresses()

  const [codeInput, setCodeInput] = useState("")
  const deliveryAddressSetRef = useRef(false)
  const couponHandledRef = useRef<string | null>(null)

  // ── Auth: attach buyer identity when logged in ────────────────────────────
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
        if (!cancelled) show({ title: err?.message || "Could not link your account to this cart.", type: "danger" })
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

  // ── Proactively set delivery address so Shopify can compute shipping ──────
  useEffect(() => {
    if (!buyerLinked || !cart?.id || !customerProfile?.addresses?.length) return
    if (deliveryAddressSetRef.current) return
    const defaultAddressId = customerProfile.defaultAddress?.id ?? customerProfile.addresses[0]?.id ?? null
    if (!defaultAddressId) return
    deliveryAddressSetRef.current = true
    const payload = customerProfile.addresses.map((addr) => ({
      address: { copyFromCustomerAddressId: addr.id },
      selected: addr.id === defaultAddressId,
      oneTimeUse: false,
    }))
    replaceDeliveryAddresses(payload).catch(() => {
      deliveryAddressSetRef.current = false
    })
  }, [buyerLinked, cart?.id, customerProfile, replaceDeliveryAddresses])

  // ── Login helper ──────────────────────────────────────────────────────────
  const promptLogin = useCallback(async () => {
    if (loginPending) return false
    setLoginPending(true)
    let success = false
    try {
      await login()
      success = true
    } catch (err: any) {
      const message = err?.message
      if (message && message !== "Login cancelled/failed") show({ title: message, type: "danger" })
    } finally {
      setLoginPending(false)
    }
    return success
  }, [login, loginPending, show])

  // ── Discount codes ────────────────────────────────────────────────────────
  const { active: discountCodes, saved: savedDiscountCodes } = useMemo(() => {
    const raw = (cart?.discountCodes ?? []) as { code?: string | null; applicable?: boolean | null }[]
    const active: { code: string; applicable: boolean | null }[] = []
    const saved: { code: string; applicable: boolean | null }[] = []
    for (const entry of raw) {
      if (typeof entry?.code !== "string") continue
      const code = entry.code.trim()
      if (!code) continue
      if (entry.applicable === true) {
        active.push({ code, applicable: true })
      } else {
        saved.push({ code, applicable: entry.applicable ?? null })
      }
    }
    return { active, saved }
  }, [cart?.discountCodes])

  const applyDiscountCode = useCallback(
    async (rawCode: string) => {
      const input = rawCode.trim()
      if (!input) return false
      try {
        await ensure.mutateAsync()
      } catch (err: any) {
        show({ title: err?.message || "Could not prepare your cart", type: "danger" })
        return false
      }
      const normalized = input.toUpperCase()
      const existing = (cart?.discountCodes ?? [])
        .map((d) => d?.code)
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      if (existing.some((c) => c.toUpperCase() === normalized)) {
        show({ title: "Code already applied", type: "info" })
        return true
      }
      try {
        const updatedCart = await updateDiscountCodesAsync([...existing, normalized])
        const updatedCodes = (updatedCart?.discountCodes ?? []) as { code?: string | null; applicable?: boolean | null }[]
        const applied = updatedCodes.find((d) => d?.code?.toUpperCase() === normalized)
        const hasItems = Number(updatedCart?.totalQuantity ?? 0) > 0
        const hasDelivery = ((updatedCart as any)?.deliveryGroups?.nodes ?? []).some(
          (g: any) => g?.selectedDeliveryOption != null,
        )
        if (!applied || applied.applicable === false) {
          if (!hasItems || !hasDelivery) {
            // Shopify cannot validate the code without items/delivery — save it for checkout
            show({ title: "Coupon saved; it will activate at checkout", type: "info" })
            return true
          }
          // Code is invalid — revert
          await updateDiscountCodesAsync(existing)
          show({ title: "Code not valid or not applicable", type: "danger" })
          return false
        }
        show({ title: "Discount applied", type: "success" })
        return true
      } catch (err: any) {
        show({ title: err?.message || "Could not apply that code", type: "danger" })
        return false
      }
    },
    [cart?.discountCodes, ensure, show, updateDiscountCodesAsync],
  )

  const handleApplyDiscount = useCallback(async () => {
    if (!codeInput.trim()) return
    await applyDiscountCode(codeInput)
    setCodeInput("")
  }, [applyDiscountCode, codeInput])

  const handleRemoveDiscount = useCallback(
    async (code: string) => {
      const existing = (cart?.discountCodes ?? [])
        .map((d) => d?.code)
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      const next = existing.filter((c) => c.toUpperCase() !== code.toUpperCase())
      try {
        await updateDiscountCodesAsync(next)
        show({ title: "Discount removed", type: "info" })
      } catch (err: any) {
        show({ title: err?.message || "Could not remove that code", type: "danger" })
      }
    },
    [cart?.discountCodes, show, updateDiscountCodesAsync],
  )

  // Handle coupon from URL param (/cart?coupon=CODE)
  useEffect(() => {
    const raw = typeof params.coupon === "string" ? params.coupon.trim() : ""
    if (!raw || !cart?.id || couponHandledRef.current === raw) return
    couponHandledRef.current = raw
    let cancelled = false
    const run = async () => {
      await applyDiscountCode(raw)
      if (!cancelled) void router.replace("/cart")
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [params.coupon, applyDiscountCode, cart?.id])

  // ── Line quantity / removal ───────────────────────────────────────────────
  // pending: Set of merchandiseIds currently mutating (controls disabled)
  // optimisticQtys: Map of merchandiseId → display quantity (before server confirms)
  const pendingMerchandiseIds = useRef<Set<string>>(new Set())
  const optimisticQtys = useRef<Map<string, number>>(new Map())
  const [renderTick, setRenderTick] = useState(0)
  const forceUpdate = useCallback(() => setRenderTick((v) => v + 1), [])

  // Always resolve the line ID from the latest cart data, not a stale closure
  const cartRef = useRef(cart)
  useEffect(() => {
    cartRef.current = cart
  }, [cart])

  const resolveLineId = useCallback((merchandiseId: string, mode: "update" | "remove"): string | null => {
    const nodes = ((cartRef.current?.lines?.nodes ?? []) as any[]).filter(Boolean)
    const node = nodes.find((n: any) => {
      if (n?.merchandise?.id !== merchandiseId) return false
      return mode === "update" ? n?.instructions?.canUpdateQuantity !== false : n?.instructions?.canRemove !== false
    })
    return node?.id ?? null
  }, [])

  const onChangeQty = useCallback(
    async (merchandiseId: string, newQty: number) => {
      if (pendingMerchandiseIds.current.has(merchandiseId)) return

      const lineId = resolveLineId(merchandiseId, newQty <= 0 ? "remove" : "update")
      if (!lineId) {
        // Line no longer on server — refresh and bail
        void refetch()
        return
      }

      pendingMerchandiseIds.current.add(merchandiseId)
      optimisticQtys.current.set(merchandiseId, Math.max(0, newQty))
      forceUpdate()

      try {
        if (newQty <= 0) {
          await removeLineAsync(lineId)
          // Await a fresh cart fetch before clearing the optimistic hide state.
          // The cartLinesRemove mutation response may still contain BOGO/automatic
          // free lines for the removed merchandise — they only vanish on the next
          // cart query. Without this await, the free lines briefly reappear.
          await refetch()
        } else {
          await updateLineAsync({ id: lineId, quantity: newQty })
        }
      } catch (e: any) {
        show({ title: e?.message || "Failed to update cart", type: "danger" })
      } finally {
        pendingMerchandiseIds.current.delete(merchandiseId)
        optimisticQtys.current.delete(merchandiseId)
        forceUpdate()
      }
    },
    [forceUpdate, refetch, removeLineAsync, resolveLineId, show, updateLineAsync],
  )

  const onDelete = useCallback(
    (merchandiseId: string) => {
      void onChangeQty(merchandiseId, 0)
    },
    [onChangeQty],
  )

  // ── Display lines: server state + optimistic qty overrides ────────────────
  const displayLines = useMemo(() => {
    const nodes = ((cart?.lines?.nodes ?? []) as LineNode[])
      .filter(Boolean)
      .filter((l) => l.__typename !== "ComponentizableCartLine")
      .filter((l) => {
        // Optimistically hide lines being removed
        const optQty = optimisticQtys.current.get(l.merchandise?.id ?? "")
        return optQty === undefined || optQty > 0
      })
      .map((l) => {
        const mid = l.merchandise?.id ?? ""
        const optQty = optimisticQtys.current.get(mid)
        // Only apply optimistic qty to lines the user can actually update.
        // Free BOGO lines share the same merchandise.id but are locked by Shopify
        // (canUpdateQuantity=false). Applying the paid line's optimistic qty to
        // them would show nonsense numbers (e.g. "+5 FREE" instead of "+2 FREE").
        const canBeUpdated = l.instructions?.canUpdateQuantity !== false
        return {
          ...l,
          quantity: optQty !== undefined && canBeUpdated ? optQty : l.quantity,
          _pending: pendingMerchandiseIds.current.has(mid),
        }
      })
    return groupByMerchandise(nodes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.lines?.nodes, renderTick])

  // ── Money: server values only — never calculated client-side ──────────────
  // This ensures the cart always shows exactly what Shopify will charge at checkout.
  const { subtotal, discountAmount, shipping, hasShippingEstimate, tax, total, hasItems } = useMemo(() => {
    const subtotal = n(cart?.cost?.subtotalAmount?.amount)
    const tax = n(cart?.cost?.totalTaxAmount?.amount)
    // totalAmount from Shopify = subtotal + taxes - cart-level discounts (excludes shipping)
    const serverTotal = n(cart?.cost?.totalAmount?.amount)

    // Cart-level discount allocations (discount codes, cart scripts, etc.)
    const allDiscountAllocations = (cart as any)?.discountAllocations ?? []
    const shippingDiscountAmt = allDiscountAllocations
      .filter((a: any) => a?.targetType === "SHIPPING_LINE")
      .reduce((s: number, a: any) => s + n(a?.discountedAmount?.amount), 0)
    const merchandiseDiscountAmt = allDiscountAllocations
      .filter((a: any) => a?.targetType !== "SHIPPING_LINE")
      .reduce((s: number, a: any) => s + n(a?.discountedAmount?.amount), 0)

    // Shipping estimate from selected delivery option (displayed as a line item, NOT added to total).
    // In current Shopify Cart API, cost.totalAmount already incorporates the selected
    // delivery cost — adding it again produces a total higher than what checkout charges.
    const deliveryNodes = (cart as any)?.deliveryGroups?.nodes ?? []
    let rawShipping = 0
    let hasShippingEstimate = false
    for (const group of deliveryNodes) {
      const amt = group?.selectedDeliveryOption?.estimatedCost?.amount
      if (amt !== undefined) {
        rawShipping += n(amt)
        hasShippingEstimate = true
      }
    }
    const shipping = hasShippingEstimate ? Math.max(0, rawShipping - shippingDiscountAmt) : 0

    // Use totalAmount directly — it is Shopify's authoritative grand total (subtotal +
    // taxes + shipping - discounts). Do NOT add shipping on top; that double-counts it.
    const total = serverTotal

    return {
      subtotal,
      discountAmount: merchandiseDiscountAmt,
      shipping,
      hasShippingEstimate,
      tax,
      total,
      hasItems: n(cart?.totalQuantity) > 0,
    }
  }, [cart])

  // ── Checkout ──────────────────────────────────────────────────────────────
  const onCheckout = useCallback(async () => {
    if (!hasItems || attachingBuyer) return
    if (authInitializing) return

    if (!isAuthenticated) {
      const loggedIn = await promptLogin()
      if (!loggedIn) return
    }

    if (!cart?.buyerIdentity?.customer?.id) {
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

    let latestProfile = customerProfile
    try {
      const refreshed = await refetchProfile()
      if (refreshed?.data) latestProfile = refreshed.data
    } catch (err: any) {
      show({ title: err?.message || "Could not check your addresses yet", type: "danger" })
      return
    }

    if (!latestProfile) {
      show({ title: "Could not load your account yet", type: "danger" })
      return
    }

    const url = cart?.checkoutUrl
    if (!url) {
      Alert.alert("Checkout unavailable", "Missing checkout URL")
      return
    }

    const hasSavedAddress = (latestProfile?.addresses?.length ?? 0) > 0
    const defaultAddressId = latestProfile?.defaultAddress?.id ?? latestProfile?.addresses?.[0]?.id ?? null

    if (!hasSavedAddress) {
      const checkoutUrlParam = encodeURIComponent(url)
      router.push({
        pathname: "/account/addresses/new",
        params: { redirect: "/checkout", checkoutUrl: checkoutUrlParam, cartId: cart?.id ?? "" },
      } as any)
      return
    }

    if (hasSavedAddress && defaultAddressId) {
      try {
        const addressPayload = latestProfile.addresses.map((addr) => ({
          address: { copyFromCustomerAddressId: addr.id },
          selected: addr.id === defaultAddressId,
          oneTimeUse: false,
        }))
        await replaceDeliveryAddresses(addressPayload)
      } catch (err: any) {
        show({ title: err?.message || "Could not prepare your default address", type: "danger" })
        return
      }
    }

    // Block checkout if any line is mid-mutation
    if (pendingMerchandiseIds.current.size > 0) {
      show({ title: "Please wait while your cart updates", type: "info" })
      return
    }

    router.push({ pathname: "/checkout", params: { url, cartId: cart?.id ?? "" } } as any)
  }, [
    attachBuyerToCustomer,
    attachingBuyer,
    authInitializing,
    cart?.buyerIdentity?.customer?.id,
    cart?.checkoutUrl,
    cart?.id,
    customerProfile,
    getToken,
    hasItems,
    isAuthenticated,
    promptLogin,
    refetchProfile,
    replaceDeliveryAddresses,
    show,
  ])

  // ── Currency display helper ───────────────────────────────────────────────
  const cartCurrency = String(cart?.cost?.totalAmount?.currencyCode ?? "USD").toUpperCase()
  const prefCurrency = String(prefCurrencyState || cartCurrency || "USD").toUpperCase()

  const fmt = useMemo(
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

  // ── Line item component ───────────────────────────────────────────────────
  const LineItem = useMemo(
    () =>
      memo(function LineItem({ item }: { item: DisplayLine }) {
        const variant = item?.merchandise
        const product = variant?.product
        const merchandiseId = variant?.id ?? item.id
        const qty = n(item?.quantity, 1)
        const unitPrice = n(variant?.price?.amount)
        const imageUrl = variant?.image?.url || product?.featuredImage?.url || ""
        const handle = product?.handle as string | undefined
        const isFree = item._freeQty > 0
        const autoDiscountTitle = item._autoDiscountTitle || item?.discountAllocations?.[0]?.title
        const canUpdateQty = !item._pending && item?.instructions?.canUpdateQuantity !== false
        const canRemove = !item._pending && item?.instructions?.canRemove !== false

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
            className="flex-row gap-3 p-3 mb-3 rounded-md bg-surface border border-border"
            accessibilityRole="summary"
          >
            <PressableOverlay onPress={goToPDP} className="rounded-md overflow-hidden" accessibilityLabel="Open product">
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
                {canRemove ? (
                  <PressableOverlay
                    accessibilityLabel="Remove from cart"
                    onPress={() => onDelete(merchandiseId)}
                    className="w-9 h-9 rounded-full items-center justify-center"
                  >
                    <Trash2 size={18} color="#8a8a8a" />
                  </PressableOverlay>
                ) : null}
              </View>

              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-1 min-w-0 pr-3">
                  <Price amount={unitPrice} currency={String(variant?.price?.currencyCode ?? cartCurrency)} />
                </View>
                <View className="px-2 py-1 rounded-full bg-surface border border-border">
                  <QuantityStepper
                    value={qty}
                    onChange={(q) => onChangeQty(merchandiseId, q)}
                    disabled={!canUpdateQty}
                  />
                </View>
              </View>

              {isFree ? (
                <View className="px-2 py-0.5 rounded bg-green-100 self-start mt-1">
                  <Text className="text-green-700 text-[11px] font-geist-semibold">+{item._freeQty} FREE</Text>
                </View>
              ) : autoDiscountTitle ? (
                <View className="px-2 py-0.5 rounded bg-green-100 self-start mt-1">
                  <Text className="text-green-700 text-[11px] font-geist-semibold">{autoDiscountTitle}</Text>
                </View>
              ) : null}
            </View>
          </Animated.View>
        )
      }),
    [cartCurrency, onChangeQty, onDelete],
  )

  // ── Footer sizing ─────────────────────────────────────────────────────────
  const [footerH, setFooterH] = useState(220)
  const listBottomPad = Math.max(footerH + (insets?.bottom ?? 0) + 16, 24)

  const loadingState = (isLoading && !cart) || ensure.isPending
  const errorState = isError && !cart

  const showUSD = prefCurrency !== "USD"

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
                  We'll save your addresses and keep this cart synced across devices.
                </Text>
              </View>
              <Button variant="outline" size="md" fullWidth onPress={promptLogin} isLoading={loginPending}>
                Sign in
              </Button>
            </Card>
          </View>
        ) : null}

        {errorState ? (
          <CenteredState
            title="Something went wrong"
            body="Please try again."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        ) : null}

        {loadingState ? <SkeletonList /> : null}

        {!loadingState && !errorState ? (
          <>
            <FlashList
              {...flashListScrollProps}
              data={displayLines}
              keyExtractor={(l: DisplayLine) => l.merchandise?.id ?? l.id}
              renderItem={({ item }) => <LineItem item={item} />}
              extraData={displayLines.length}
              ListEmptyComponent={<EmptyCart />}
              contentContainerStyle={{ padding: 16, paddingBottom: listBottomPad }}
              keyboardShouldPersistTaps={defaultKeyboardShouldPersistTaps}
              scrollIndicatorInsets={{ bottom: listBottomPad }}
              showsVerticalScrollIndicator={false}
            />

            {/* Sticky summary footer */}
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
                      {/* Discount codes */}
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

                        {!hasItems && savedDiscountCodes.length > 0 ? (
                          <View className="gap-2">
                            <Text className="text-[#475569] text-[12px] font-geist-semibold">Saved coupons</Text>
                            <View className="gap-2">
                              {savedDiscountCodes.map((code) => (
                                <View
                                  key={code.code}
                                  className="flex-row items-center justify-between rounded-xl border border-dashed border-border bg-[#fdf2fa] px-3 py-2"
                                >
                                  <View className="flex-1 pr-3">
                                    <Text className="text-[#0f172a] font-geist-semibold text-[14px]">
                                      {code.code}
                                    </Text>
                                    <Text className="text-[#6b7280] text-[11px]">
                                      Will activate once you add items
                                    </Text>
                                  </View>
                                  <PressableOverlay
                                    onPress={() => handleRemoveDiscount(code.code)}
                                    disabled={updatingDiscounts}
                                    className="h-8 w-8 items-center justify-center rounded-full"
                                    accessibilityLabel={`Remove saved coupon ${code.code}`}
                                  >
                                    <X size={16} color="#475569" />
                                  </PressableOverlay>
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null}

                        <View className="flex-row items-center gap-3">
                          <Input
                            value={codeInput}
                            onChangeText={setCodeInput}
                            placeholder="ادخل كود الخصم او رمز الكوبون"
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

                      {/* Pricing breakdown — always from server, never calculated */}
                      <SummaryRows
                        subtotal={subtotal}
                        discountAmount={discountAmount}
                        shipping={shipping}
                        hasShippingEstimate={hasShippingEstimate}
                        tax={tax}
                        total={total}
                        cartCurrency={cartCurrency}
                        prefCurrency={prefCurrency}
                        showUSD={showUSD}
                        fmt={fmt}
                      />

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

// ── Subcomponents ─────────────────────────────────────────────────────────────

function SummaryRows({
  subtotal,
  discountAmount,
  shipping,
  hasShippingEstimate,
  tax,
  total,
  cartCurrency,
  prefCurrency,
  showUSD,
  fmt,
}: {
  subtotal: number
  discountAmount: number
  shipping: number
  hasShippingEstimate: boolean
  tax: number
  total: number
  cartCurrency: string
  prefCurrency: string
  showUSD: boolean
  fmt: (v: number, cur: string) => string
}) {
  const cv = (v: number, toCur: string) => convertAmount(v, cartCurrency, toCur)
  return (
    <>
      <Row label="Subtotal">
        <DualAmount
          main={fmt(cv(subtotal, prefCurrency), prefCurrency)}
          alt={showUSD ? fmt(cv(subtotal, "USD"), "USD") : undefined}
        />
      </Row>
      {tax > 0 ? (
        <Row label="Taxes">
          <DualAmount
            main={fmt(cv(tax, prefCurrency), prefCurrency)}
            alt={showUSD ? fmt(cv(tax, "USD"), "USD") : undefined}
          />
        </Row>
      ) : null}
      {discountAmount > 0 ? (
        <Row label="Discounts">
          <DualAmount
            main={`-${fmt(cv(discountAmount, prefCurrency), prefCurrency)}`}
            alt={showUSD ? `-${fmt(cv(discountAmount, "USD"), "USD")}` : undefined}
            tone="danger"
          />
        </Row>
      ) : null}
      {hasShippingEstimate ? (
        <Row label="Shipping">
          <DualAmount
            main={shipping === 0 ? "Free" : fmt(cv(shipping, prefCurrency), prefCurrency)}
            alt={showUSD && shipping > 0 ? fmt(cv(shipping, "USD"), "USD") : undefined}
          />
        </Row>
      ) : null}
      <Divider />
      <Row label="Total">
        <DualAmount
          main={fmt(cv(total, prefCurrency), prefCurrency)}
          alt={showUSD ? fmt(cv(total, "USD"), "USD") : undefined}
          emphasize
        />
      </Row>
      {!hasShippingEstimate ? (
        <Text className="text-secondary text-[11px] text-center mt-1">Shipping & taxes calculated at checkout</Text>
      ) : null}
    </>
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

// ── Types + utils ─────────────────────────────────────────────────────────────

type LineNode = {
  id: string
  quantity: number
  __typename?: string
  instructions?: { canRemove: boolean; canUpdateQuantity: boolean }
  merchandise?: {
    id?: string
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
    totalAmount?: { amount?: number | string; currencyCode?: string }
    amountPerQuantity?: { amount?: number | string; currencyCode?: string }
  }
  discountAllocations?: {
    discountedAmount?: { amount?: number | string; currencyCode?: string }
    title?: string
    code?: string
  }[]
}

type DisplayLine = LineNode & { _freeQty: number; _autoDiscountTitle: string; _pending: boolean }

// Group lines by merchandiseId, folding free BOGO lines into the primary line.
function groupByMerchandise(lines: (LineNode & { _pending: boolean })[]): DisplayLine[] {
  const groups = new Map<string, DisplayLine>()
  for (const line of lines) {
    const mid = line.merchandise?.id ?? line.id
    // A line is "free" if Shopify marks it non-updatable or its total cost is zero
    const isFree =
      line.instructions?.canUpdateQuantity === false ||
      (n(line.cost?.totalAmount?.amount) === 0 && n(line.quantity) > 0)
    const autoTitle = line.discountAllocations?.find((d) => d.title)?.title ?? ""
    const existing = groups.get(mid)
    if (!existing) {
      groups.set(mid, { ...line, _freeQty: isFree ? n(line.quantity) : 0, _autoDiscountTitle: isFree ? autoTitle : "" })
    } else if (isFree) {
      groups.set(mid, {
        ...existing,
        _freeQty: existing._freeQty + n(line.quantity),
        _autoDiscountTitle: existing._autoDiscountTitle || autoTitle,
      })
    } else {
      groups.set(mid, {
        ...line,
        _freeQty: existing._freeQty,
        _autoDiscountTitle: existing._autoDiscountTitle,
      })
    }
  }
  return Array.from(groups.values())
}

function n(x: unknown, fallback = 0): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : fallback
}
