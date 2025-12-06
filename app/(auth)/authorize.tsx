import { handleAuthorizationRedirect, cancelLogin } from "@/lib/shopify/customer/auth"
import { SHOPIFY_CUSTOMER_REDIRECT_URI } from "@/lib/shopify/env"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { useToast } from "@/ui/feedback/Toast"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { ActivityIndicator, View } from "react-native"
import { WebView } from "react-native-webview"

export default function AuthorizationScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>()
  const authorizeUrl = typeof url === "string" ? url : ""
  const router = useRouter()
  const { show } = useToast()
  const completedRef = useRef(false)

  const source = useMemo(() => ({ uri: authorizeUrl }), [authorizeUrl])

  const handleAuthRedirect = useCallback(
    async (current: string) => {
      try {
        await handleAuthorizationRedirect(current)
        completedRef.current = true
        show({ title: "Signed in", type: "success" })
      } catch (err: any) {
        const message = err?.message || "Could not sign in"
        show({ title: message, type: "danger" })
      } finally {
        router.back()
      }
    },
    [router, show],
  )

  useEffect(() => {
    if (!authorizeUrl) {
      cancelLogin("Login could not be started")
      show({ title: "Missing login URL", type: "danger" })
      router.back()
    }
  }, [authorizeUrl, cancelLogin, router, show])

  useEffect(() => {
    return () => {
      if (!completedRef.current) {
        cancelLogin()
      }
    }
  }, [cancelLogin])

  const handleNavChange = useCallback(
    async (navState: { url?: string }) => {
      const current = navState.url || ""
      if (!current) return

      if (current.startsWith(SHOPIFY_CUSTOMER_REDIRECT_URI)) {
        handleAuthRedirect(current)
      }
    },
    [handleAuthRedirect],
  )

  const handleShouldStart = useCallback(
    (request: { url: string }) => {
      const current = request.url || ""
      if (!current) return true

      if (current.startsWith(SHOPIFY_CUSTOMER_REDIRECT_URI)) {
        handleAuthRedirect(current)
        return false
      }

      return true
    },
    [handleAuthRedirect],
  )

  return (
    <Screen bleedBottom>
      <MenuBar back />
      <View style={{ flex: 1 }}>
        {authorizeUrl ? (
          <WebView
            source={source}
            onNavigationStateChange={handleNavChange}
            onShouldStartLoadWithRequest={handleShouldStart}
            startInLoadingState
            renderLoading={() => (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color="#0f172a" />
              </View>
            )}
            style={{ flex: 1 }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#0f172a" />
          </View>
        )}
      </View>
    </Screen>
  )
}
