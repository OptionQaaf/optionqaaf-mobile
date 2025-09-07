import { hydrateCartId } from "@/store/cartId"
import { FontProvider } from "@/theme/FontProvider"
import { ToastHost } from "@/ui/feedback/Toast"
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
            <Stack screenOptions={{ headerShown: false }} />
            <ToastHost />
          </FontProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}
