import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { withLoggedInParam } from "@/lib/shopify/checkout"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { H2, Muted } from "@/ui/primitives/Typography"
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
        <View className="flex-1 items-center justify-center gap-6 px-8">
          <H2 className="text-center">Sign in to test checkout handoff</H2>
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
            <H2>Checkout handoff</H2>
            <Muted>Append the `logged_in` flag and jump into checkout.</Muted>
          </View>

          <Card padding="lg" className="gap-4">
            <Input
              value={url}
              onChangeText={setUrl}
              placeholder="https://checkout.shopify.com/..."
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
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
