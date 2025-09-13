import { DrawerProvider } from "@/features/navigation/Drawer" // ⬅️ add
import { hydrateCartId } from "@/store/cartId"
import { FontProvider } from "@/theme/FontProvider"
import { ToastHost } from "@/ui/feedback/Toast"
import { AddToCartFlyOverlay } from "@/ui/cart/AddToCartFly"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import { useEffect } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"

const client = new QueryClient()

export default function RootLayout() {
  useEffect(() => {
    hydrateCartId()
  }, [])

  return (
    <QueryClientProvider client={client}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <FontProvider>
            <DrawerProvider>
              <Stack screenOptions={{ headerShown: false, animation: "fade", gestureEnabled: false }}>
                <Stack.Screen name="products/[handle]" options={{ gestureEnabled: true }} />
              </Stack>
              <ToastHost />
              <AddToCartFlyOverlay />
            </DrawerProvider>
          </FontProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}
