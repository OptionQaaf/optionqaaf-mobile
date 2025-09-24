import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Linking, View } from "react-native"
import { WebView } from "react-native-webview"

import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { H3, Muted, Text } from "@/ui/primitives/Typography"

import {
  completeCustomerOAuthSession,
  createCustomerOAuthSession,
  type CustomerOAuthSession,
} from "@/features/account/oauth"

type WebViewRequest = { url: string }

const STORE_ID = "85072904499"
// MUST match your Headless → Customer Account API → Application setup → Callback URI
const REDIRECT_SCHEME = `shop.${STORE_ID}.app://callback`

export default function AccountSignIn() {
  const toast = useToast()
  const router = useRouter()
  const webViewRef = useRef<WebView>(null)

  const [session, setSession] = useState<CustomerOAuthSession | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authorizeUrl = useMemo(() => session?.authorizeUrl ?? "", [session?.authorizeUrl])
  const redirectUri = useMemo(() => session?.redirectUri ?? REDIRECT_SCHEME, [session?.redirectUri])

  // Prepare OAuth session (PKCE etc.)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setInitializing(true)
        const prepared = await createCustomerOAuthSession()
        if (!cancelled) {
          setSession(prepared)
          setError(null)
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "We couldn’t load the sign in page. Please try again.")
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Parse shop.<id>.app://callback?code=...&state=...
  const parseAndComplete = useCallback(
    async (url: string) => {
      if (!session) return
      try {
        const u = new URL(url)
        const params = u.searchParams
        const errCode = params.get("error")
        const errDesc = params.get("error_description") || params.get("message")
        if (errCode) {
          const msg = errDesc || errCode || "Authentication was cancelled"
          setError(msg)
          toast.show({ title: msg, type: "danger" })
          return
        }

        const code = params.get("code")
        const state = params.get("state")
        if (!code) {
          const msg = "Authentication response missing authorization code"
          setError(msg)
          toast.show({ title: msg, type: "danger" })
          return
        }

        setCompleting(true)
        await completeCustomerOAuthSession({
          code,
          state,
          expectedState: session.state,
          codeVerifier: session.codeVerifier,
        })
        toast.show({ title: "Signed in", type: "success" })
        router.replace("/account")
      } catch (err: any) {
        const msg = err?.message || "Something went wrong while processing the sign in response."
        setError(msg)
        toast.show({ title: msg, type: "danger" })
      } finally {
        setCompleting(false)
      }
    },
    [router, session, toast],
  )

  // Handle scheme deep-link in case it escapes WebView (Expo Go safety net)
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (url?.startsWith(redirectUri)) parseAndComplete(url)
    })
    return () => sub.remove()
  }, [parseAndComplete, redirectUri])

  // Block navigation to the custom scheme before the OS sees it
  const handleShouldStart = useCallback(
    (request: WebViewRequest) => {
      const url = request?.url ?? ""
      if (!url) return true
      if (url.startsWith(redirectUri)) {
        parseAndComplete(url)
        return false // prevent external open
      }
      return true
    },
    [parseAndComplete, redirectUri],
  )

  // iOS sometimes doesn’t fire shouldStart on every hop; double-check here
  const handleNavChange = useCallback(
    (nav: any) => {
      const url = nav?.url ?? ""
      if (url.startsWith(redirectUri)) parseAndComplete(url)
    },
    [parseAndComplete, redirectUri],
  )

  const handleReload = useCallback(() => {
    setError(null)
    setSession(null)
    setInitializing(true)
    void createCustomerOAuthSession()
      .then((prepared) => {
        setSession(prepared)
        setError(null)
      })
      .catch((err: any) => {
        setError(err?.message || "We couldn’t load the sign in page. Please try again.")
      })
      .finally(() => setInitializing(false))
  }, [])

  const showWebView = !!authorizeUrl && !error

  return (
    <Screen bleedBottom>
      <StatusBar style="dark" />
      <MenuBar variant="light" back />
      <View className="flex-1 bg-white">
        {showWebView ? (
          <WebView
            ref={webViewRef}
            source={{ uri: authorizeUrl }}
            // Keep everything inside the WebView (critical for Expo Go)
            onShouldStartLoadWithRequest={handleShouldStart}
            onNavigationStateChange={handleNavChange}
            // Prevent external windows / target=_blank
            setSupportMultipleWindows={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
            sharedCookiesEnabled
            incognito
            startInLoadingState
            style={{ flex: 1 }}
            onError={(e) => {
              const msg = e?.nativeEvent?.description || "We couldn’t load the sign in page."
              setError(msg)
              toast.show({ title: msg, type: "danger" })
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-6 gap-4">
            {initializing ? (
              <ActivityIndicator size="large" color="#0B0B0B" />
            ) : (
              <>
                <View className="items-center gap-2">
                  <H3 className="font-geist-semibold">Sign in to OptionQaaf</H3>
                  <Muted className="text-center text-[15px]">
                    {error || "We couldn’t open the Shopify sign in experience."}
                  </Muted>
                </View>
                <Button onPress={handleReload}>{session ? "Reload" : "Try again"}</Button>
              </>
            )}
          </View>
        )}

        {(initializing || completing) && showWebView ? (
          <View className="absolute inset-0 items-center justify-center bg-white/40">
            <ActivityIndicator size="large" color="#0B0B0B" />
            <Text className="mt-3 text-[15px] font-geist-medium">{completing ? "Finishing up..." : "Loading"}</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  )
}
