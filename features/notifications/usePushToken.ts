import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { useNotificationSettings } from "@/store/notifications"
import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { useEffect, useRef } from "react"
import { AppState, Platform } from "react-native"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")

type PushRegistrationResult = { granted: boolean; token: string | null }

async function requestPushToken(): Promise<PushRegistrationResult> {
  let permissions = await Notifications.getPermissionsAsync()

  if (!permissions.granted && permissions.canAskAgain) {
    permissions = await Notifications.requestPermissionsAsync()
  }

  if (!permissions.granted) {
    return { granted: false, token: null }
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const projectId = Constants?.easConfig?.projectId ?? Constants?.expoConfig?.extra?.eas?.projectId
  const response = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync()

  return { granted: true, token: response.data }
}

async function registerWithWorker(token: string, email: string | null) {
  if (!WORKER_URL) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[push] Missing EXPO_PUBLIC_PUSH_WORKER_URL; skipping token registration")
    }
    return
  }

  const res = await fetch(`${WORKER_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, email }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Push registration failed with status ${res.status}`)
  }
}

export function usePushToken() {
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated })
  const expoPushToken = useNotificationSettings((s) => s.expoPushToken)
  const pushEnabled = useNotificationSettings((s) => s.pushEnabled)
  const setPreferences = useNotificationSettings((s) => s.setPreferences)

  const lastRegisteredKey = useRef<string | null>(null)

  useEffect(() => {
    if (!pushEnabled || !expoPushToken) {
      lastRegisteredKey.current = null
    }
  }, [pushEnabled, expoPushToken])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // Force a re-register attempt when the app resumes to recover from revoked tokens.
        lastRegisteredKey.current = null
        // Re-run sync flow by toggling dependency changes via setPreferences when needed.
        setPreferences((prev) => ({ pushEnabled: prev.pushEnabled, expoPushToken: prev.expoPushToken }))
      }
    })
    return () => sub.remove()
  }, [setPreferences])

  useEffect(() => {
    let cancelled = false

    const syncPushToken = async () => {
      if (!pushEnabled) return
      if (!WORKER_URL) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[push] Missing EXPO_PUBLIC_PUSH_WORKER_URL; skipping token registration")
        }
        return
      }

      try {
        const result = await requestPushToken()
        if (!result.granted || !result.token || cancelled) {
          setPreferences({ pushEnabled: false, expoPushToken: null })
          return
        }

        if (expoPushToken !== result.token || !pushEnabled) {
          setPreferences({
            expoPushToken: result.token,
            pushEnabled: true,
          })
        }

        const email = isAuthenticated ? profile?.email ?? null : null
        const payloadKey = `${result.token}:${email ?? ""}`

        if (payloadKey !== lastRegisteredKey.current) {
          await registerWithWorker(result.token, email)
          lastRegisteredKey.current = payloadKey
        }
      } catch (err) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[push] Unable to register push token", err)
        }
        setPreferences({ pushEnabled: false, expoPushToken: null })
      }
    }

    syncPushToken()

    return () => {
      cancelled = true
    }
  }, [expoPushToken, isAuthenticated, profile?.email, pushEnabled, setPreferences])
}
