import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { SHOPIFY_CUSTOMER_REDIRECT_URI as REDIRECT_URI } from "@/lib/shopify/env"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { useFocusEffect } from "@react-navigation/native"
import { router, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { WebView } from "react-native-webview"
import * as WebBrowser from "expo-web-browser"

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

  const launchExternalGoogleAuth = useCallback(
    async (target: string) => {
      settlingRef.current = true
      try {
        await WebBrowser.warmUpAsync()
        const result = await WebBrowser.openAuthSessionAsync(target, REDIRECT_URI, {
          preferEphemeralSession: false,
        })
        if (result.type === "success" && result.url) {
          await handleAuthRedirect(result.url)
          router.back()
          return
        }
        throw new Error("Login cancelled")
      } catch (err: any) {
        settlingRef.current = false
        setError(err?.message || "Login failed")
      } finally {
        await WebBrowser.coolDownAsync()
      }
    },
    [handleAuthRedirect],
  )

  const handleExternalIfGoogle = useCallback(
    (target: string) => {
      try {
        const parsed = new URL(target)
        if (parsed.hostname.endsWith("accounts.google.com")) {
          launchExternalGoogleAuth(target)
          return false
        }
      } catch {
        // ignore parsing errors
      }
      return true
    },
    [launchExternalGoogleAuth],
  )

  const handleIntercept = useCallback(
    (target: string) => {
      if (!target || settlingRef.current) return false
      if (!handleExternalIfGoogle(target)) return false
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
    [handleAuthRedirect, handleExternalIfGoogle],
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
