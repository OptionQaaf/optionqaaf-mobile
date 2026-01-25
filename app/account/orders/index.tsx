import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { getOrderStatusStyle } from "@/features/account/account.services"
import { useCustomerOrders } from "@/features/account/orders/api"
import { AuthGate } from "@/features/auth/AuthGate"
import { formatMoney } from "@/lib/shopify/money"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { H1 } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { Image } from "expo-image"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo } from "react"
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native"

const PAGE_SIZE = 10

export default function OrdersScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/orders" as const)} />}
    >
      <Screen bleedBottom>
        <MenuBar back />
        <OrdersContent />
      </Screen>
    </AuthGate>
  )
}

function OrdersContent() {
  const { show } = useToast()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isLoading, error, isRefetching } =
    useCustomerOrders(PAGE_SIZE)

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Could not load orders"
      show({ title: message, type: "danger" })
    }
  }, [error, show])

  const router = useRouter()

  const orders = useMemo(
    () =>
      data?.pages
        .flatMap((page) => page.orders)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) ?? [],
    [data],
  )

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    fetchNextPage().catch(() => {})
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const handlePress = useCallback(
    (orderId: string) => {
      const encoded = encodeURIComponent(orderId)
      router.push(`/account/orders/${encoded}` as const)
    },
    [router],
  )

  const renderItem = useCallback(
    ({ item }: { item: (typeof orders)[number] }) => {
      const total = item.totalPrice
        ? formatMoney({ amount: item.totalPrice.amount.toFixed(2), currencyCode: item.totalPrice.currencyCode })
        : "—"
      const when = formatDate(item.createdAt)
      const linePreview = item.lineItemsPreview.slice(0, 5)
      const remaining = Math.max(0, item.lineItemsPreview.length - linePreview.length)
      const note = item.note?.trim()

      return (
        <PressableOverlay onPress={() => handlePress(item.id)} className="mb-4">
          <Card padding="lg" className="gap-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[#0f172a] font-geist-semibold text-[16px]">{item.name}</Text>
                <Text className="text-[#64748b] text-[13px]">{when}</Text>
              </View>
              <View className="items-end gap-1">
                {(() => {
                  const style = getOrderStatusStyle(item.latestFulfillmentStatus)
                  return <Badge label={style.label} bg={style.bg} color={style.color} />
                })()}
              </View>
            </View>
            <View className="gap-2">
              <View className="flex-row gap-2">
                {linePreview.map((line) => (
                  <View
                    key={line.id}
                    className="h-14 w-14 rounded-xl bg-[#e2e8f0] overflow-hidden items-center justify-center"
                  >
                    {line.imageUrl ? (
                      <Image
                        source={{ uri: line.imageUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <View className="h-full w-full items-center justify-center bg-[#f1f5f9]">
                        <Text className="text-[#cbd5f5] text-[12px]">—</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
              {remaining > 0 ? (
                <Text className="text-[#64748b] text-[12px]">
                  +{remaining} more item{remaining === 1 ? "" : "s"}
                </Text>
              ) : null}
              {note ? (
                <Text className="text-[#475569] text-[12px]" numberOfLines={2}>
                  ملاحظات: {note}
                </Text>
              ) : null}
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[#0f172a] font-geist-semibold text-[15px]">{total}</Text>
              {item.confirmationNumber ? (
                <Text className="text-[#64748b] text-[12px]">Confirmation {item.confirmationNumber}</Text>
              ) : null}
            </View>
          </Card>
        </PressableOverlay>
      )
    },
    [handlePress],
  )

  return (
    <>
      <H1 className="px-5">Orders</H1>
      <Text className="px-5 pt-1 text-[#64748b] text-[12px]" numberOfLines={2}>
        Recent orders from the last 60 days are shown here. Older orders are still safe—contact us if you need the full
        history.
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching || isLoading} onRefresh={() => refetch()} tintColor="#111827" />
        }
        onEndReachedThreshold={0.4}
        onEndReached={handleLoadMore}
        ListEmptyComponent={
          isLoading ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator />
            </View>
          ) : (
            <View className="py-20 items-center gap-2">
              <Text className="text-[#0f172a] font-geist-semibold text-[16px]">No orders yet</Text>
              <Text className="text-[#64748b] text-[13px] text-center px-6">
                When you place an order, it’ll show up here with its latest status.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-6 items-center">
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
    </>
  )
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View className="px-2 py-[2px] rounded-full" style={{ backgroundColor: bg }}>
      <Text className="text-[11px] font-geist-medium" style={{ color }}>
        {label}
      </Text>
    </View>
  )
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
