import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { ActivityIndicator, View } from "react-native"
import { WebView } from "react-native-webview"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { StatusBar } from "expo-status-bar"
import { useToast } from "@/ui/feedback/Toast"
import { Button } from "@/ui/primitives/Button"
import { H3, Muted, Text } from "@/ui/primitives/Typography"
import { useRouter } from "expo-router"
import {
  completeCustomerOAuthSession,
  createCustomerOAuthSession,
  type CustomerOAuthSession,
} from "@/features/account/oauth"

type WebViewRequest = {
  url: string
}

export default function AccountSignIn() {
  const toast = useToast()
  const router = useRouter()
  const webViewRef = useRef<WebView>(null)
  const [session, setSession] = useState<CustomerOAuthSession | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authorizeUrl = useMemo(() => session?.authorizeUrl ?? "", [session?.authorizeUrl])

  useEffect(() => {
    let cancelled = false

    const prepare = async () => {
      try {
        setInitializing(true)
        const prepared = await createCustomerOAuthSession()
        if (!cancelled) {
          setSession(prepared)
          setError(null)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "We couldn’t load the sign in page. Please try again.")
        }
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    prepare()

    return () => {
      cancelled = true
    }
  }, [])

  const handleComplete = useCallback(
    async (code: string, state: string | null | undefined) => {
      if (!session) return
      try {
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
        const message = err?.message || "We couldn’t finish signing you in. Please try again."
        setError(message)
        toast.show({ title: message, type: "danger" })
      } finally {
        setCompleting(false)
      }
    },
    [router, session, toast],
  )

  const handleAuthRedirect = useCallback(
    (url: string) => {
      if (!session) return

      try {
        const next = new URL(url)
        const params = next.searchParams
        const errorParam = params.get("error")
        const errorDescription = params.get("error_description") || params.get("message")

        if (errorParam) {
          const message = errorDescription || errorParam || "Authentication was cancelled"
          setError(message)
          toast.show({ title: message, type: "danger" })
          return
        }

        const code = params.get("code")
        const state = params.get("state")
        if (!code) {
          setError("Authentication response missing authorization code")
          toast.show({ title: "Authentication failed", type: "danger" })
          return
        }

        void handleComplete(code, state)
      } catch (err: any) {
        const message = err?.message || "Something went wrong while processing the sign in response."
        setError(message)
        toast.show({ title: message, type: "danger" })
      }
    },
    [handleComplete, session, toast],
  )

  const handleShouldStart = useCallback(
    (request: WebViewRequest) => {
      if (!session) return true
      if (request.url.startsWith(session.redirectUri)) {
        handleAuthRedirect(request.url)
        return false
      }
      return true
    },
    [handleAuthRedirect, session],
  )

  const handleReload = () => {
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
  }

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
            onShouldStartLoadWithRequest={handleShouldStart}
            startInLoadingState
            sharedCookiesEnabled
            incognito
            style={{ flex: 1 }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent
              const message = nativeEvent?.description || "We couldn’t load the sign in page."
              setError(message)
              toast.show({ title: message, type: "danger" })
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
