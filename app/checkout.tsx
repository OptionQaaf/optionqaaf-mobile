import { qk } from "@/lib/shopify/queryKeys"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { useLocalSearchParams } from "expo-router"
import { useCallback, useMemo, useRef } from "react"
import { View } from "react-native"
import { WebView } from "react-native-webview"
import { useQueryClient } from "@tanstack/react-query"
import { useCartId } from "@/store/cartId"

const THANK_YOU_REGEX = /(thank[_-]?you|order[_-]?confirmation)/i

export default function CheckoutScreen() {
  const { url, cartId: cartIdParam } = useLocalSearchParams<{ url: string; cartId?: string }>()
  const checkoutUrl = typeof url === "string" ? url : ""
  const cartId = typeof cartIdParam === "string" && cartIdParam.trim().length ? cartIdParam : undefined
  const queryClient = useQueryClient()
  const clearedRef = useRef(false)

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
      }
    },
    [cartId, queryClient],
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
