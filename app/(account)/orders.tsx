import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { customerGraphQL } from "@/lib/shopify/customer/client"
import { MeOrdersDocument, type MeOrdersQuery, type MeOrdersQueryVariables } from "@/lib/shopify/customer/gql/graphql"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { H2, Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { useQuery } from "@tanstack/react-query"
import * as WebBrowser from "expo-web-browser"
import { useCallback } from "react"
import { ActivityIndicator, View } from "react-native"

const PAGE_SIZE = 20

export default function OrdersScreen() {
  const { isAuthenticated, login } = useShopifyAuth()

  const query = useQuery({
    queryKey: ["customer", "me", "orders"],
    queryFn: () => customerGraphQL<MeOrdersQuery, MeOrdersQueryVariables>(MeOrdersDocument, { first: PAGE_SIZE }),
    enabled: isAuthenticated,
  })

  const openStatus = useCallback((url?: string | null) => {
    if (!url) return
    WebBrowser.openBrowserAsync(url).catch(() => {})
  }, [])

  if (!isAuthenticated) {
    return (
      <Screen>
        <MenuBar back />
        <View className="flex-1 items-center justify-center gap-6 px-8">
          <H2 className="text-center">Sign in to view your orders</H2>
          <Button size="lg" onPress={login} accessibilityLabel="Sign in to Shopify">
            Sign in
          </Button>
        </View>
      </Screen>
    )
  }

  const orders = query.data?.customer?.orders?.nodes ?? []

  return (
    <Screen>
      <MenuBar back />
      <PageScrollView contentContainerClassName="px-5 py-6">
        <View className="gap-5">
          <View className="gap-2">
            <H2>Orders</H2>
            <Muted>Track your latest Shopify purchases.</Muted>
          </View>

          {query.isLoading ? (
            <Card padding="lg" className="items-center py-8">
              <ActivityIndicator />
            </Card>
          ) : orders.length > 0 ? (
            <View className="gap-4">
              {orders.map((order) => (
                <Card key={order.id} padding="lg" className="gap-3">
                  <Text className="text-[17px] font-geist-semibold">{order.name ?? "Order"}</Text>
                  <View className="gap-1">
                    <Muted className="text-[13px] uppercase tracking-wide">Placed</Muted>
                    <Text className="text-[15px]">{formatDate(order.createdAt)}</Text>
                  </View>
                  <View className="gap-1">
                    <Muted className="text-[13px] uppercase tracking-wide">Total</Muted>
                    <Text className="text-[15px]">{formatPrice(order.totalPrice?.amount, order.currencyCode)}</Text>
                  </View>
                  {order.statusPageUrl ? (
                    <Button
                      variant="outline"
                      onPress={() => openStatus(order.statusPageUrl)}
                      accessibilityLabel="Open status page"
                    >
                      View status
                    </Button>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : (
            <Card padding="lg">
              <Muted>No orders yet.</Muted>
            </Card>
          )}
        </View>
      </PageScrollView>
    </Screen>
  )
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

function formatPrice(amount?: string | null, currency?: string | null) {
  if (!amount) return "—"
  const parsed = Number(amount)
  if (!Number.isFinite(parsed)) return `${amount} ${currency ?? ""}`.trim()
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
    }).format(parsed)
  } catch {
    return `${parsed.toFixed(2)} ${currency ?? ""}`.trim()
  }
}
