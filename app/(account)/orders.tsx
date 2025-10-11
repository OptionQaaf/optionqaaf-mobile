import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { customerGraphQL } from "@/lib/shopify/customer/client"
import { MeOrdersDocument, type MeOrdersQuery, type MeOrdersQueryVariables } from "@/lib/shopify/customer/gql/graphql"
import { AccountSectionHeading, OrderPreviewCard } from "./components"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Muted, Text } from "@/ui/primitives/Typography"
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
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-[20px] font-geist-semibold text-center">Sign in to view your orders</Text>
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
      <PageScrollView contentContainerClassName="px-6 py-8">
        <View className="gap-6">
          <AccountSectionHeading title="My orders" description="Below are all of your recent orders." />

          {query.isLoading ? (
            <Card padding="lg" className="items-center py-8 bg-white">
              <ActivityIndicator />
            </Card>
          ) : orders.length > 0 ? (
            <View className="gap-4">
              {orders.map((order) => (
                <Card key={order.id} padding="lg" className="gap-4 bg-white">
                  <OrderPreviewCard order={order} />
                  {order.statusPageUrl ? (
                    <Button
                      variant="outline"
                      onPress={() => openStatus(order.statusPageUrl)}
                      accessibilityLabel="Open status page"
                    >
                      View status page
                    </Button>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : (
            <Card padding="lg" className="bg-white">
              <Muted>No orders yet.</Muted>
            </Card>
          )}
        </View>
      </PageScrollView>
    </Screen>
  )
}
