import { AuthGate } from "@/features/auth/AuthGate"
import { ShopifyAuthProvider } from "@/features/auth/useShopifyAuth"
import { FypGenderPopup } from "@/features/fyp/genderPopup"
import { useFypGenderStore } from "@/features/fyp/genderStore"
import { useFypTrackingStore } from "@/features/fyp/trackingStore"
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
import { FloatingDock } from "@/ui/nav/FloatingDock"
import { FloatingDockScaleProvider } from "@/ui/nav/FloatingDockContext"
import { RootMenuBar } from "@/ui/nav/RootMenuBar"
import { InAppPopupModal } from "@/ui/popup/InAppPopupModal"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { router, Stack, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useCallback, useEffect, useState } from "react"
import { Linking, LogBox } from "react-native"
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

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
})

LogBox.ignoreLogs([
  "VirtualizedLists should never be nested",
  "Non-serializable values were found in the navigation state",
  "SafeAreaView has been deprecated and will be removed in a future release",
  "[Reanimated]",
  "Require cycle:",
  "Setting a timer",
  "expo-router",
])

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false)
  const [cartReady, setCartReady] = useState(false)
  const [splashReady, setSplashReady] = useState(false)

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
    if (!fontsReady || !cartReady) return

    let active = true
    ;(async () => {
      try {
        await SplashScreen.hideAsync()
      } catch {
        // noop
      } finally {
        if (active) setSplashReady(true)
      }
    })()

    return () => {
      active = false
    }
  }, [fontsReady, cartReady])

  return (
    <SafeAreaProvider>
      <ShopifyAuthProvider>
        <QueryClientProvider client={client}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppBootstrap fontsReady={fontsReady} splashReady={splashReady} />
            <AuthGate>
              <FontProvider onReady={() => setFontsReady(true)}>
                <DrawerProvider>
                  <RootMenuBar />
                  <FloatingDockScaleProvider>
                    <Stack
                      screenOptions={({ route }) => ({
                        headerShown: false,
                        animation: "fade",
                        animationDuration: 240,
                        gestureEnabled:
                          route.name === "cart" ||
                          route.name === "products/[handle]" ||
                          route.name === "products/for-you-feed" ||
                          route.name.startsWith("account/") ||
                          route.name.startsWith("collections") ||
                          route.name.startsWith("policies/national-address"),
                      })}
                    />
                    <FloatingDock />
                  </FloatingDockScaleProvider>
                  <ToastHost />
                </DrawerProvider>
              </FontProvider>
            </AuthGate>
            <InAppPopupHost />
            <FypGenderPopup enabled={splashReady} />
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ShopifyAuthProvider>
    </SafeAreaProvider>
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

function AppBootstrap({ fontsReady, splashReady }: { fontsReady: boolean; splashReady: boolean }) {
  const metadata = useAppMetadata()
  const segments = useSegments()
  const navigationReady = segments.length > 0
  const startupReady = fontsReady && splashReady && navigationReady
  const networkStatus = useNetworkStatus()
  const isExpoGo = metadata.applicationId === "host.exp.Exponent"
  const hydrateFypGender = useFypGenderStore((state) => state.hydrate)
  const loadFypTracking = useFypTrackingStore((state) => state.loadFromStorage)

  useNotificationsService({ enabled: startupReady && !isExpoGo })
  usePushToken({ enabled: startupReady && !isExpoGo })
  usePopupService({ fontsReady: startupReady, navigationReady: startupReady, splashReady: startupReady })

  useEffect(() => {
    if (!startupReady) return
    hydrateFypGender().catch(() => {})
    loadFypTracking()
  }, [startupReady, hydrateFypGender, loadFypTracking])

  useEffect(() => {
    if (!startupReady) return
    requestTrackingAuthorizationIfNeeded()
  }, [startupReady])

  useEffect(() => {
    if (!__DEV__ || isExpoGo) return
    console.debug("[app] metadata", metadata)
  }, [
    isExpoGo,
    metadata,
    metadata.appName,
    metadata.version,
    metadata.buildNumber,
    metadata.applicationId,
    metadata.ownership,
  ])

  const { isConnected, isInternetReachable, type } = networkStatus
  useEffect(() => {
    if (!__DEV__ || isExpoGo) return
    console.debug("[app] network", {
      isConnected,
      isInternetReachable,
      type,
    })
  }, [isConnected, isExpoGo, isInternetReachable, type])

  return null
}
