import { useState } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { startLogin } from "@/lib/shopify/customer/auth"
import { getShopifyCustomerConfig } from "@/lib/shopify/customer/config"

export function CustomerLoginScreen() {
  const router = useRouter()
  const { shopDomain } = getShopifyCustomerConfig()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSignIn = async () => {
    if (isLoading) return
    setError(null)
    try {
      setIsLoading(true)
      await startLogin()
      router.replace("/test/customer-account")
    } catch (err: any) {
      const message = err instanceof Error ? err.message : "Unable to start Shopify login"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 24 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Shopify Customer Account</Text>
        <Text style={{ fontSize: 16, color: "#4b5563" }}>
          Authenticate with {shopDomain} using Shopify&apos;s Customer Account API. The flow uses PKCE with a custom
          deep link for Expo.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onSignIn}
        style={{
          backgroundColor: "#111827",
          paddingVertical: 16,
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Sign in with Shopify</Text>
        )}
      </Pressable>

      {error ? (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#fee2e2" }}>
          <Text style={{ color: "#991b1b", fontSize: 14 }}>{error}</Text>
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>
          Ensure the callback scheme from EXPO_PUBLIC_SHOPIFY_AUTH_SCHEME is registered in your Headless/Hydrogen sales
          channel configuration.
        </Text>
      </View>
    </View>
  )
}
