import { AuthGate } from "@/features/auth/AuthGate"
import { ShopifyAuthProvider } from "@/features/auth/useShopifyAuth"
import { DrawerProvider } from "@/features/navigation/Drawer"
import { useNotificationsService } from "@/features/notifications/notificationService"
import { usePushToken } from "@/features/notifications/usePushToken"
import { usePopupService } from "@/features/popup/usePopupService"
import { requestTrackingAuthorizationIfNeeded } from "@/lib/TrackingAuthorizationManager"
import { useAppMetadata } from "@/lib/diagnostics/appMetadata"
import { useNetworkStatus } from "@/lib/network/useNetworkStatus"
import { hydrateCartId } from "@/store/cartId"
import { usePopupStore } from "@/store/popup"
import { FontProvider } from "@/theme/FontProvider"
import type { PopupCTA } from "@/types/popup"
import { ToastHost } from "@/ui/feedback/Toast"
import { InAppPopupModal } from "@/ui/popup/InAppPopupModal"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { router, Stack, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useCallback, useEffect, useState } from "react"
import { Linking } from "react-native"
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
          <AppBootstrap fontsReady={fontsReady} />
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
                        route.name === "cart" ||
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
          <InAppPopupHost />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ShopifyAuthProvider>
  )
}

function InAppPopupHost() {
  const popup = usePopupStore((state) => state.popup)
  const clearPopup = usePopupStore((state) => state.clearPopup)

  const handleDismiss = useCallback(() => {
    clearPopup()
  }, [clearPopup])

  const handleCta = useCallback(
    (cta: PopupCTA | undefined) => {
      if (!cta) {
        clearPopup()
        return
      }

      clearPopup()
      const value = cta.value?.trim()
      if (!value) return
      if (cta.action === "apply_coupon") {
        router.push({
          pathname: "/cart",
          params: { coupon: value },
        })
        return
      }
      const external = /^(https?:|mailto:|tel:|sms:)/i.test(value)
      if (external) {
        Linking.openURL(value).catch(() => {})
        return
      }
      try {
        router.push(value as any)
      } catch {
        Linking.openURL(value).catch(() => {})
      }
    },
    [clearPopup],
  )

  if (!popup) return null
  return <InAppPopupModal popup={popup} visible={Boolean(popup)} onDismiss={handleDismiss} onCtaPress={handleCta} />
}

function AppBootstrap({ fontsReady }: { fontsReady: boolean }) {
  const metadata = useAppMetadata()
  const segments = useSegments()
  const navigationReady = segments.length > 0
  const networkStatus = useNetworkStatus()

  useNotificationsService()
  usePushToken()
  usePopupService({ fontsReady, navigationReady })

  useEffect(() => {
    requestTrackingAuthorizationIfNeeded()
  }, [])

  useEffect(() => {
    console.debug("[app] metadata", metadata)
  }, [metadata, metadata.appName, metadata.version, metadata.buildNumber, metadata.applicationId, metadata.ownership])

  const { isConnected, isInternetReachable, type } = networkStatus
  useEffect(() => {
    console.debug("[app] network", {
      isConnected,
      isInternetReachable,
      type,
    })
  }, [isConnected, isInternetReachable, type])

  return null
}
