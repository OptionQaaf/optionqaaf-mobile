import { qk } from "@/lib/shopify/queryKeys"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useMemo, useRef } from "react"
import { View } from "react-native"
import { WebView } from "react-native-webview"
import { useQueryClient } from "@tanstack/react-query"
import { useCartId } from "@/store/cartId"

const THANK_YOU_REGEX = /(thank[_-]?you|order[_-]?confirmation)/i

export default function CheckoutScreen() {
  const { url, cartId: cartIdParam, applePay } = useLocalSearchParams<{ url: string; cartId?: string; applePay?: string }>()
  const checkoutUrl = typeof url === "string" ? url : ""
  const cartId = typeof cartIdParam === "string" && cartIdParam.trim().length ? cartIdParam : undefined
  const router = useRouter()
  const queryClient = useQueryClient()
  const clearedRef = useRef(false)
  const isApplePayCheckout = applePay === "true" || applePay === "1"

  const checkoutSource = useMemo(() => ({ uri: checkoutUrl }), [checkoutUrl])

  const handleNavChange = useCallback(
    (navState: { url?: string }) => {
      if (!cartId || clearedRef.current) return
      const current = navState.url || ""
      if (!current) return
      if (THANK_YOU_REGEX.test(current)) {
        clearedRef.current = true
        useCartId.getState().setCartId(null)
        queryClient.removeQueries({ queryKey: qk.cart(cartId) })
        if (isApplePayCheckout) {
          router.replace("/checkout-address-review" as const)
          return
        }
      }
    },
    [cartId, isApplePayCheckout, queryClient, router],
  )

  return (
    <Screen bleedBottom>
      <MenuBar back />
      <View style={{ flex: 1 }}>
        <WebView source={checkoutSource} style={{ flex: 1 }} onNavigationStateChange={handleNavChange} />
      </View>
    </Screen>
  )
}
