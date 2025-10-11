import { customerGraphQL } from "@/lib/shopify/customer/client"
import {
  MeOrdersDocument,
  MeProfileDocument,
  type MeOrdersQuery,
  type MeOrdersQueryVariables,
  type MeProfileQuery,
} from "@/lib/shopify/customer/gql/graphql"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import {
  AccountList,
  AccountListItem,
  AccountSectionHeading,
  AccountSummaryCard,
  OrderPreviewCard,
  formatCreationDate,
  formatFullName,
} from "./components"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import { ActivityIndicator, View } from "react-native"

const PAGE_SIZE = 3

export default function AccountIndex() {
  const { isAuthenticated, login, logout } = useShopifyAuth()

  const profileQuery = useQuery({
    queryKey: ["customer", "me", "profile", "overview"],
    queryFn: () => customerGraphQL<MeProfileQuery>(MeProfileDocument),
    enabled: isAuthenticated,
  })

  const ordersQuery = useQuery({
    queryKey: ["customer", "me", "orders", "overview"],
    queryFn: () => customerGraphQL<MeOrdersQuery, MeOrdersQueryVariables>(MeOrdersDocument, { first: PAGE_SIZE }),
    enabled: isAuthenticated,
  })

  const profile = profileQuery.data?.customer ?? null
  const orders = ordersQuery.data?.customer?.orders?.nodes ?? []
  const creationDate = formatCreationDate(profile?.creationDate)
  if (!isAuthenticated) {
    return (
      <Screen>
        <MenuBar back />
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-[20px] font-geist-semibold text-center">Account</Text>
          <Button size="lg" onPress={login} accessibilityLabel="Sign in to Shopify">
            Sign in
          </Button>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <MenuBar back />
      <PageScrollView contentContainerClassName="px-6 py-8">
        <View className="gap-6">
          <AccountSummaryCard
            person={{
              subtitle: "Account",
              name: formatFullName(profile) ?? profile?.displayName ?? "",
              email: profile?.emailAddress?.emailAddress ?? undefined,
              phone: profile?.phoneNumber?.number ?? undefined,
              imageUrl: profile?.imageUrl ?? undefined,
            }}
            footer={
              profileQuery.isLoading ? (
                <View className="py-4 items-center">
                  <ActivityIndicator />
                </View>
              ) : (
                <Muted className="text-[14px]">Member since {creationDate ?? "—"}</Muted>
              )
            }
          />

          <AccountList>
            <AccountListItem
              title="Addresses"
              description="Saved shipping destinations"
              onPress={() => router.push("/(account)/addresses")}
            />
            <AccountListItem
              title="Orders"
              description="Your recent purchases"
              onPress={() => router.push("/(account)/orders")}
            />
            <AccountListItem
              title="Profile"
              description="Account details and preferences"
              onPress={() => router.push("/(account)/profile")}
            />
            <AccountListItem
              title="Checkout handoff"
              description="Test logged-in checkout URLs"
              onPress={() => router.push("/(account)/checkout-test")}
            />
          </AccountList>

          <Card padding="lg" className="gap-4 bg-white">
            <AccountSectionHeading title="My orders" description="Below are your most recent orders." />
            {ordersQuery.isLoading ? (
              <View className="py-4 items-center">
                <ActivityIndicator />
              </View>
            ) : orders.length > 0 ? (
              <View className="gap-4">
                {orders.map((order) => (
                  <OrderPreviewCard key={order.id} order={order} />
                ))}
                <Button variant="outline" onPress={() => router.push("/(account)/orders")}>
                  View all orders
                </Button>
              </View>
            ) : (
              <Muted>No orders yet.</Muted>
            )}
          </Card>

          <Button variant="outline" onPress={logout} accessibilityLabel="Sign out of Shopify">
            Log out
          </Button>
        </View>
      </PageScrollView>
    </Screen>
  )
}
