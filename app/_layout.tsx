import { DrawerProvider } from "@/features/navigation/Drawer"
import { hydrateCartId } from "@/store/cartId"
import { FontProvider } from "@/theme/FontProvider"
import { ToastHost } from "@/ui/feedback/Toast"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect, useState } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated"
import { SafeAreaProvider } from "react-native-safe-area-context"

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false)
  const [cartReady, setCartReady] = useState(false)

  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {})
    ;(async () => {
      try {
        await hydrateCartId()
        setCartReady(true)
      } catch {
        setCartReady(true)
      }
    })()
  }, [])

  configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
  })

  useEffect(() => {
    if (fontsReady && cartReady) SplashScreen.hideAsync().catch(() => {})
  }, [fontsReady, cartReady])

  return (
    <QueryClientProvider client={client}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <FontProvider onReady={() => setFontsReady(true)}>
            <DrawerProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade",
                  animationDuration: 240,
                  gestureEnabled: false,
                }}
              >
                <Stack.Screen name="products/[handle]" options={{ gestureEnabled: true }} />
              </Stack>
              <ToastHost />
            </DrawerProvider>
          </FontProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}
