import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { getOrderStatusStyle } from "@/features/account/account.services"
import { useCustomerOrder } from "@/features/account/orders/api"
import { AuthGate } from "@/features/auth/AuthGate"
import { Products } from "@/lib/shopify"
import type { OrderDetail } from "@/lib/shopify/customer/orders"
import { formatMoney } from "@/lib/shopify/money"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Card } from "@/ui/surfaces/Card"
import { Image } from "expo-image"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Truck } from "lucide-react-native"
import { useCallback, useEffect, useMemo } from "react"
import { ActivityIndicator, Linking, RefreshControl, ScrollView, Text, View } from "react-native"

type SegmentedLineItem = { item: OrderDetail["lineItems"][number]; quantity: number }
type SegmentedLineItems = Array<SegmentedLineItem & { status: string }>

export default function OrderDetailScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/orders" as const)} />}
    >
      <Screen bleedBottom>
        <MenuBar back />
        <OrderDetailContent />
      </Screen>
    </AuthGate>
  )
}

function OrderDetailContent() {
  const params = useLocalSearchParams<{ orderId?: string }>()
  const router = useRouter()
  const orderId = useMemo(() => {
    const raw = params.orderId
    if (Array.isArray(raw)) return raw.length ? decodeURIComponent(raw[0]) : null
    if (typeof raw === "string") return decodeURIComponent(raw)
    return null
  }, [params.orderId])

  const { show } = useToast()
  const { data, isLoading, error, refetch, isRefetching } = useCustomerOrder(orderId)

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Could not load order"
      show({ title: message, type: "danger" })
    }
  }, [error, show])

  const statusPageUrl = data?.statusPageUrl

  const openStatusPage = useCallback(() => {
    if (statusPageUrl) Linking.openURL(statusPageUrl).catch(() => {})
  }, [statusPageUrl])

  const orderStatusStyle = useMemo(() => {
    const status = data?.latestFulfillmentStatus ?? data?.fulfillments?.[0]?.status ?? null
    return getOrderStatusStyle(status)
  }, [data])

  const segmentedLineItems = useMemo<SegmentedLineItems>(() => {
    if (!data) return []

    const orderStatus = (data.latestFulfillmentStatus ?? "").toUpperCase()

    return data.lineItems.flatMap((item) => {
      const totalQuantity = Number.isFinite(item.quantity) ? item.quantity : 0
      if (totalQuantity <= 0) return []

      const fulfilledQuantity = data.fulfilledLineItemQuantities[item.id] ?? 0
      const remaining = Math.max(0, totalQuantity - fulfilledQuantity)
      const segments: SegmentedLineItems = []

      if (fulfilledQuantity > 0) {
        segments.push({ item, quantity: fulfilledQuantity, status: "FULFILLED" })
      }

      if (remaining > 0) {
        const status = orderStatus.includes("CANCEL")
          ? "CANCELLED"
          : fulfilledQuantity > 0
            ? "PARTIALLY_FULFILLED"
            : "UNFULFILLED"
        segments.push({ item, quantity: remaining, status })
      }

      return segments
    })
  }, [data])

  const orderNote = useMemo(() => {
    if (!data) return null
    const noteFromApi = data.note?.trim()
    return noteFromApi && noteFromApi.length ? noteFromApi : null
  }, [data])

  const handleLinePress = useCallback(
    async (item: NonNullable<typeof data>["lineItems"][number]) => {
      const productId = item.productId
      if (!productId) {
        show({ title: "Product unavailable", type: "info" })
        return
      }
      try {
        const handle = await Products.getProductHandleById(productId)
        if (!handle) {
          show({ title: "Product unavailable", type: "info" })
          return
        }
        router.push(`/products/${handle}` as const)
      } catch {
        show({ title: "Product unavailable", type: "info" })
      }
    },
    [router, show],
  )

  if (isLoading && !data) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  }

  if (!data) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text className="text-[#0f172a] font-geist-semibold text-[16px] mb-2">Order not found</Text>
        <Button variant="ghost" onPress={() => refetch()}>
          Retry
        </Button>
      </ScrollView>
    )
  }

  const totalPrice = moneyOrFallback(data.totalPrice)
  const subtotal = moneyOrFallback(data.subtotal)
  const tax = moneyOrFallback(data.totalTax)
  const shipping = moneyOrFallback(data.totalShipping)
  const refunded = moneyOrFallback(data.totalRefunded)

  return (
    <ScrollView
      className="flex-1 bg-[#f8fafc]"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, gap: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#111827" />}
    >
      <Card padding="lg" className="gap-3">
        <Text className="text-[#0f172a] font-geist-semibold text-[18px]">{data.name}</Text>
        <Text className="text-[#64748b] text-[13px]">Placed {formatDate(data.createdAt)}</Text>
        <Badge label={orderStatusStyle.label} bg={orderStatusStyle.bg} color={orderStatusStyle.color} />
        <Text className="text-[#64748b] text-[12px]">{formatDateWithTime(data.createdAt)}</Text>
        <Text className="text-[#0f172a] font-geist-semibold text-[20px] mt-4">{totalPrice}</Text>
        {data.confirmationNumber ? (
          <Text className="text-[#64748b] text-[13px]">Confirmation {data.confirmationNumber}</Text>
        ) : null}
        {statusPageUrl ? (
          <Button variant="outline" size="sm" onPress={openStatusPage} className="mt-4" fullWidth>
            View status page
          </Button>
        ) : null}
        {orderNote ? (
          <View className="bg-[#f8fafc] rounded-xl px-3 py-2 mt-2">
            <Text className="text-[#0f172a] font-geist-medium text-[13px]">Order note</Text>
            <Text className="text-[#475569] text-[13px] mt-[2px]">{orderNote}</Text>
          </View>
        ) : null}
      </Card>

      <Card padding="lg" className="gap-4">
        <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Items</Text>
        {segmentedLineItems.length ? (
          <View className="gap-3">
            {segmentedLineItems.map(({ item, quantity, status }) => {
              const segmentSubtotal = (() => {
                if (!item.subtotal || item.quantity <= 0) return null
                const unitPrice = item.subtotal.amount / item.quantity
                if (!Number.isFinite(unitPrice)) return null
                const amount = unitPrice * quantity
                if (!Number.isFinite(amount)) return null
                return formatMoney({
                  amount: amount.toFixed(2),
                  currencyCode: item.subtotal.currencyCode,
                })
              })()
              const totalLabel = item.quantity > quantity ? ` of ${item.quantity}` : ""
              const statusText = (() => {
                const base =
                  status === "FULFILLED" ? "Fulfilled" : status === "CANCELLED" ? "Cancelled" : "Not fulfilled"
                return totalLabel ? `${base} ${quantity}${totalLabel}` : `${base} ${quantity}`
              })()
              const badgeStyle = getOrderStatusStyle(status)

              return (
                <View key={`${item.id}-${status}`} className="flex-row w-full gap-4">
                  <PressableOverlay
                    key={`${item.id}-${status}`}
                    className="flex-row w-full items-center gap-4 rounded-2xl px-3 py-2 bg-[#f1f5f9]"
                    pressableClassName="flex-1"
                    onPress={() => handleLinePress(item)}
                  >
                    <View className="h-14 w-14 rounded-xl bg-white overflow-hidden items-center justify-center">
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <Text className="text-[#64748b] text-[12px]">×{quantity}</Text>
                      )}
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-[#0f172a] text-[15px] font-geist-medium" numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.variantTitle ? (
                        <Text className="text-[#64748b] text-[13px]" numberOfLines={1}>
                          {item.variantTitle}
                        </Text>
                      ) : null}
                      <View className="flex-row items-center gap-2">
                        <Badge label={badgeStyle.label} bg={badgeStyle.bg} color={badgeStyle.color} />
                      </View>
                    </View>
                  </PressableOverlay>
                  {(() => {
                    const trackingEntries =
                      Array.isArray(item.tracking) && item.tracking.length
                        ? item.tracking.filter((track) => track && (track.url || track.number || track.company))
                        : []
                    const showTrackingSection = status === "FULFILLED" && trackingEntries.length > 0
                    if (!showTrackingSection) return null
                    return (
                      <>
                        {trackingEntries.map((track, idx) => {
                          console.log("track", track)
                          const url = track.url ?? null
                          if (!url) return null
                          const key = `${track.url ?? ""}|${track.number ?? ""}|${track.company ?? ""}|${idx}`
                          const label = track.number ? `Open tracking ${track.number}` : "Open tracking"
                          return (
                            <View key={key} className="flex-row items-center gap-2">
                              <PressableOverlay
                                className="h-9 w-10 px-0 items-center justify-center rounded-lg"
                                accessibilityLabel={label}
                                disabled={!url}
                                onPress={() => {
                                  if (!url) {
                                    console.error("Missing tracking URL")
                                    return
                                  }
                                  Linking.openURL(url).catch(() =>
                                    show({ title: "Unable to open tracking link", type: "danger" }),
                                  )
                                }}
                              >
                                <Truck size={16} color="#0f172a" />
                              </PressableOverlay>
                            </View>
                          )
                        })}
                      </>
                    )
                  })()}
                </View>
              )
            })}
          </View>
        ) : (
          <Text className="text-[#64748b] text-[13px]">No items</Text>
        )}
      </Card>

      <Card padding="lg" className="gap-3">
        <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Summary</Text>
        <SummaryRow label="Subtotal" value={subtotal} />
        <SummaryRow label="Shipping" value={shipping} />
        <SummaryRow label="Tax" value={tax} />
        <SummaryRow label="Refunded" value={refunded} />
        <View className="border-t border-[#e2e8f0] pt-3 mt-1">
          <SummaryRow label="Total" value={totalPrice} emphasize />
        </View>
      </Card>

      <View className="gap-4">
        <Card padding="lg" className="gap-3">
          <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Shipping address</Text>
          <AddressLines address={data.shippingAddress} fallback="No shipping address" />
        </Card>
        <Card padding="lg" className="gap-3">
          <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Billing address</Text>
          <AddressLines address={data.billingAddress} fallback="No billing address" />
        </Card>
      </View>
    </ScrollView>
  )
}

function SummaryRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className={`text-[14px] ${emphasize ? "font-geist-semibold text-[#0f172a]" : "text-[#475569]"}`}>
        {label}
      </Text>
      <Text className={`text-[14px] ${emphasize ? "font-geist-semibold text-[#0f172a]" : "text-[#0f172a]"}`}>
        {value}
      </Text>
    </View>
  )
}

function AddressLines({
  address,
  fallback,
}: {
  address?: {
    lines: string[]
    address1?: string | null
    address2?: string | null
    city?: string | null
    province?: string | null
    country?: string | null
    zip?: string | null
  } | null
  fallback: string
}) {
  const lines = normalizeAddressOptional(address)
  if (!lines.length) {
    return <Text className="text-[#64748b] text-[13px]">{fallback}</Text>
  }
  return (
    <View className="gap-[2px]">
      {lines.map((line, idx) => (
        <Text key={`${line}-${idx}`} className="text-[#475569] text-[13px]">
          {line}
        </Text>
      ))}
    </View>
  )
}

function normalizeAddressOptional(
  address:
    | ({
        lines: string[]
        address1?: string | null
        address2?: string | null
        city?: string | null
        province?: string | null
        country?: string | null
        zip?: string | null
      } | null)
    | undefined,
): string[] {
  if (!address) return []
  if (Array.isArray(address.lines) && address.lines.length) return address.lines
  const fallback = [
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.country,
    address.zip,
  ].filter((value): value is string => !!value && value.trim().length > 0)
  return fallback
}

function moneyOrFallback(value?: { amount: number; currencyCode: string } | null, fallback = "—"): string {
  if (!value) return fallback
  return formatMoney({ amount: value.amount.toFixed(2), currencyCode: value.currencyCode })
}

function formatDateWithTime(value: string): string {
  try {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return value
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
  } catch {
    return value
  }
}

function formatDate(value: string): string {
  try {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return value
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
  } catch {
    return value
  }
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View className="px-2 py-1 rounded-full" style={{ backgroundColor: bg }}>
      <Text className="text-[11px] font-geist-medium" style={{ color }}>
        {label}
      </Text>
    </View>
  )
}
