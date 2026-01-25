import { AuthGate } from "@/features/auth/AuthGate"
import { ShopifyAuthProvider } from "@/features/auth/useShopifyAuth"
import { DrawerProvider } from "@/features/navigation/Drawer"
import { useNotificationsService } from "@/features/notifications/notificationService"
import { usePushToken } from "@/features/notifications/usePushToken"
import { hydrateCartId } from "@/store/cartId"
import { requestTrackingAuthorizationIfNeeded } from "@/lib/TrackingAuthorizationManager"
import { useAppMetadata } from "@/lib/diagnostics/appMetadata"
import { useNetworkStatus } from "@/lib/network/useNetworkStatus"
import { FontProvider } from "@/theme/FontProvider"
import { ToastHost } from "@/ui/feedback/Toast"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect, useState } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
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

  useEffect(() => {
    if (fontsReady && cartReady) SplashScreen.hideAsync().catch(() => {})
  }, [fontsReady, cartReady])

  return (
    <ShopifyAuthProvider>
      <QueryClientProvider client={client}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AppBootstrap />
          <AuthGate>
            <SafeAreaProvider>
              <FontProvider onReady={() => setFontsReady(true)}>
                <DrawerProvider>
                  <Stack
                    screenOptions={({ route }) => ({
                      headerShown: false,
                      animation: "fade",
                      animationDuration: 240,
                      gestureEnabled:
                        route.name === "products/[handle]" ||
                        route.name.startsWith("account/") ||
                        route.name.startsWith("collections") ||
                        route.name.startsWith("policies/national-address"),
                    })}
                  />
                  <ToastHost />
                </DrawerProvider>
              </FontProvider>
            </SafeAreaProvider>
          </AuthGate>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ShopifyAuthProvider>
  )
}

function AppBootstrap() {
  const metadata = useAppMetadata()
  const networkStatus = useNetworkStatus()

  useNotificationsService()
  usePushToken()

  useEffect(() => {
    requestTrackingAuthorizationIfNeeded()
  }, [])

  useEffect(() => {
    console.debug("[app] metadata", metadata)
  }, [metadata.appName, metadata.version, metadata.buildNumber, metadata.applicationId, metadata.ownership])

  const { isConnected, isInternetReachable, isExpensive, type } = networkStatus
  useEffect(() => {
    console.debug("[app] network", {
      isConnected,
      isInternetReachable,
      isExpensive,
      type,
    })
  }, [isConnected, isInternetReachable, isExpensive, type])

  return null
}
