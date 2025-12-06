import { handleAuthorizationRedirect, cancelLogin } from "@/lib/shopify/customer/auth"
import { SHOPIFY_CUSTOMER_REDIRECT_URI } from "@/lib/shopify/env"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { useToast } from "@/ui/feedback/Toast"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { ActivityIndicator, View } from "react-native"
import { WebView, type WebViewMessageEvent } from "react-native-webview"

export default function AuthorizationScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>()
  const authorizeUrl = typeof url === "string" ? url : ""
  const router = useRouter()
  const { show } = useToast()
  const completedRef = useRef(false)
  const handledRedirectRef = useRef(false)
  const webviewRef = useRef<WebView>(null)

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

  const handleRedirect = useCallback(
    (current: string) => {
      if (!current.startsWith(SHOPIFY_CUSTOMER_REDIRECT_URI)) {
        return false
      }

      if (handledRedirectRef.current) return true

      handledRedirectRef.current = true
      webviewRef.current?.stopLoading?.()
      handleAuthRedirect(current)
      return true
    },
    [handleAuthRedirect],
  )

  const handleNavChange = useCallback(
    async (navState: { url?: string }) => {
      const current = navState.url || ""
      if (!current) return

      handleRedirect(current)
    },
    [handleRedirect],
  )

  const handleShouldStart = useCallback(
    (request: { url: string }) => {
      const current = request.url || ""
      if (!current) return true

      if (handleRedirect(current)) return false

      return true
    },
    [handleRedirect],
  )

  const injectedRedirectTrap = useMemo(
    () => `
      (function() {
        const target = ${JSON.stringify(SHOPIFY_CUSTOMER_REDIRECT_URI)};
        function notify(url) {
          try {
            const asString = url ? url.toString() : ""
            if (asString && asString.startsWith(target)) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: "redirect", url: asString }))
            }
          } catch (e) {
            // noop
          }
        }

        notify(window.location.href)

        const assign = window.location.assign
        const replace = window.location.replace
        const push = history.pushState
        const replaceState = history.replaceState

        window.location.assign = function(url) {
          notify(url)
          return assign.call(this, url)
        }

        window.location.replace = function(url) {
          notify(url)
          return replace.call(this, url)
        }

        history.pushState = function(state, title, url) {
          notify(url)
          return push.call(this, state, title, url)
        }

        history.replaceState = function(state, title, url) {
          notify(url)
          return replaceState.call(this, state, title, url)
        }
      })();
      true;
    `,
    [],
  )

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data)
        if (data?.type === "redirect" && typeof data.url === "string") {
          handleRedirect(data.url)
        }
      } catch {
        // ignore parse errors
      }
    },
    [handleRedirect],
  )

  return (
    <Screen bleedBottom>
      <MenuBar back />
      <View style={{ flex: 1 }}>
        {authorizeUrl ? (
          <WebView
            ref={webviewRef}
            source={source}
            onNavigationStateChange={handleNavChange}
            onShouldStartLoadWithRequest={handleShouldStart}
            onMessage={handleMessage}
            injectedJavaScript={injectedRedirectTrap}
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
