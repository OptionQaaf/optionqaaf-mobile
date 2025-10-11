import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { withLoggedInParam } from "@/lib/shopify/checkout"
import { AccountSectionHeading } from "./components"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import * as WebBrowser from "expo-web-browser"
import { useState } from "react"
import { View } from "react-native"

export default function CheckoutTestScreen() {
  const { isAuthenticated, login } = useShopifyAuth()
  const [url, setUrl] = useState("")
  const [isOpening, setIsOpening] = useState(false)

  const openCheckout = async () => {
    if (!url.trim()) return
    const next = withLoggedInParam(url.trim())
    try {
      setIsOpening(true)
      await WebBrowser.openBrowserAsync(next)
    } finally {
      setIsOpening(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <Screen>
        <MenuBar back />
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-[20px] font-geist-semibold text-center">Sign in to test checkout handoff</Text>
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
          <AccountSectionHeading
            title="Checkout handoff"
            description="Append the logged-in flag and preview your checkout URL."
          />

          <Card padding="lg" className="gap-4 bg-white">
            <Input
              value={url}
              onChangeText={setUrl}
              placeholder="https://checkout.shopify.com/..."
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Muted className="text-[13px]">
              We’ll automatically append <Text className="font-geist-medium text-primary">logged_in=true</Text> to your
              URL.
            </Muted>
            <Button
              onPress={openCheckout}
              disabled={!url.trim() || isOpening}
              isLoading={isOpening}
              accessibilityLabel="Open checkout in browser"
            >
              Open checkout
            </Button>
          </Card>
        </View>
      </PageScrollView>
    </Screen>
  )
}
