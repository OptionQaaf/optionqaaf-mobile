import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { SHOPIFY_CUSTOMER_REDIRECT_URI as REDIRECT_URI } from "@/lib/shopify/env"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { useFocusEffect } from "@react-navigation/native"
import { router, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { WebView } from "react-native-webview"

export default function AuthScreen() {
  const { url: urlParam } = useLocalSearchParams<{ url?: string }>()
  const { handleAuthRedirect, cancelLogin } = useShopifyAuth()
  const [error, setError] = useState<string | null>(null)
  const settlingRef = useRef(false)

  const authUrl = useMemo(() => {
    if (typeof urlParam !== "string") return null
    try {
      return decodeURIComponent(urlParam)
    } catch {
      return urlParam
    }
  }, [urlParam])

  const handleIntercept = useCallback(
    (target: string) => {
      if (!target || settlingRef.current) return false
      if (target.startsWith(REDIRECT_URI)) {
        settlingRef.current = true
        handleAuthRedirect(target)
          .then(() => router.back())
          .catch((err: any) => {
            settlingRef.current = false
            setError(err?.message || "Login failed")
          })
        return false
      }
      return true
    },
    [handleAuthRedirect],
  )

  useEffect(() => {
    return () => {
      if (!settlingRef.current) cancelLogin()
    }
  }, [cancelLogin])

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!settlingRef.current) cancelLogin()
      }
    }, [cancelLogin]),
  )

  const source = useMemo(() => (authUrl ? { uri: authUrl } : null), [authUrl])

  return (
    <Screen bleedBottom>
      <MenuBar back />
      <View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 12 }}>
        <View style={{ flex: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#ffffff" }}>
          {source ? (
            <WebView
              source={source}
              originWhitelist={["*"]}
              onShouldStartLoadWithRequest={(req) => handleIntercept(req.url || "")}
              onNavigationStateChange={(navState) => handleIntercept(navState.url || "")}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}>
                  <ActivityIndicator color="#38bdf8" />
                </View>
              )}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b111f" }}>
              <Text style={{ color: "#e2e8f0" }}>No sign-in URL provided.</Text>
            </View>
          )}
        </View>
      </View>
    </Screen>
  )
}
