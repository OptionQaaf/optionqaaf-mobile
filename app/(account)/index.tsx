import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { H2, Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { router } from "expo-router"
import { useMemo } from "react"
import { View } from "react-native"

const links = [
  { title: "Profile", description: "View your account details", href: "/(account)/profile" },
  { title: "Addresses", description: "Manage saved shipping info", href: "/(account)/addresses" },
  { title: "Orders", description: "Review your recent purchases", href: "/(account)/orders" },
  { title: "Checkout handoff", description: "Test logged-in checkout", href: "/(account)/checkout-test" },
] as const

export default function AccountIndex() {
  const { isAuthenticated, login, logout } = useShopifyAuth()
  const cards = useMemo(() => links, [])

  if (!isAuthenticated) {
    return (
      <Screen>
        <MenuBar back />
        <View className="flex-1 items-center justify-center gap-6 px-8">
          <H2 className="text-center">Account</H2>
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
      <PageScrollView contentContainerClassName="px-5 py-6">
        <View className="gap-5">
          <View className="gap-2">
            <H2>Customer account</H2>
            <Muted>Access your personal details, addresses, orders, and checkout tools.</Muted>
          </View>
          <View className="gap-4">
            {cards.map((item) => (
              <PressableOverlay key={item.href} className="rounded-xl" onPress={() => router.push(item.href as any)}>
                <Card padding="lg" className="gap-2">
                  <Text className="font-geist-semibold text-[18px]">{item.title}</Text>
                  <Muted>{item.description}</Muted>
                </Card>
              </PressableOverlay>
            ))}
          </View>
          <View className="pt-4">
            <Button variant="outline" onPress={logout} accessibilityLabel="Sign out of Shopify">
              Log out
            </Button>
          </View>
        </View>
      </PageScrollView>
    </Screen>
  )
}
