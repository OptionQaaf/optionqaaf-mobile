import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import type { PushPermissionsStatus } from "@/features/notifications/permissions"
import { requestPushPermissionsAndToken } from "@/features/notifications/permissions"
import { useNotificationSettings, type NotificationPermissionState } from "@/store/notifications"
import { useNetworkStatus } from "@/lib/network/useNetworkStatus"
import { useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")
const ADMIN_SECRET = process.env.EXPO_PUBLIC_PUSH_ADMIN_SECRET

function summarizePermissionState(status: PushPermissionsStatus): NotificationPermissionState {
  return {
    status: status.status,
    granted: status.granted,
    canAskAgain: status.canAskAgain,
  }
}

async function registerWithWorker(token: string, email: string | null) {
  if (!WORKER_URL) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[push] Missing EXPO_PUBLIC_PUSH_WORKER_URL; skipping token registration")
    }
    return
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (ADMIN_SECRET) headers["x-admin-secret"] = ADMIN_SECRET

  const res = await fetch(`${WORKER_URL}/api/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token, email }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Push registration failed with status ${res.status}`)
  }
}

type UsePushTokenOptions = {
  enabled?: boolean
}

export function usePushToken({ enabled = true }: UsePushTokenOptions = {}) {
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated && enabled })
  const expoPushToken = useNotificationSettings((s) => s.expoPushToken)
  const pushEnabled = useNotificationSettings((s) => s.pushEnabled)
  const setPreferences = useNotificationSettings((s) => s.setPreferences)
  const { isConnected, isInternetReachable } = useNetworkStatus()

  const lastRegisteredKey = useRef<string | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [syncKey, setSyncKey] = useState(0)

  useEffect(() => {
    if (!enabled) return
    if (!pushEnabled || !expoPushToken) {
      lastRegisteredKey.current = null
    }
  }, [enabled, pushEnabled, expoPushToken])

  useEffect(() => {
    if (!enabled) return
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // Force a re-register attempt when the app resumes to recover from revoked tokens.
        lastRegisteredKey.current = null
        setSyncKey((prev) => prev + 1)
      }
    })
    return () => sub.remove()
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const scheduleRetry = () => {
      if (cancelled || retryTimer.current) return
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null
        setRetryKey((prev) => prev + 1)
      }, 15000)
    }

    const syncPushToken = async () => {
      if (!pushEnabled) return
      if (isConnected === false || isInternetReachable === false) {
        scheduleRetry()
        return
      }
      if (!WORKER_URL) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[push] Missing EXPO_PUBLIC_PUSH_WORKER_URL; skipping token registration")
        }
        return
      }

      try {
        const result = await requestPushPermissionsAndToken()
        const permissionSummary = summarizePermissionState(result.status)
        setPreferences({ permissionsStatus: permissionSummary })
        if (!result.granted) {
          setPreferences({
            pushEnabled: false,
            expoPushToken: null,
            permissionsStatus: permissionSummary,
          })
          return
        }
        if (cancelled) return
        if (!result.token) {
          scheduleRetry()
          return
        }

        if (expoPushToken !== result.token || !pushEnabled) {
          setPreferences({
            expoPushToken: result.token,
            pushEnabled: true,
            permissionsStatus: permissionSummary,
          })
        }

        const email = isAuthenticated ? (profile?.email ?? null) : null
        const payloadKey = `${result.token}:${email ?? ""}`

        if (payloadKey !== lastRegisteredKey.current) {
          const attemptTime = new Date().toISOString()
          setPreferences({ lastRegistrationAttempt: attemptTime })
          try {
            await registerWithWorker(result.token, email)
            lastRegisteredKey.current = payloadKey
            if (retryTimer.current) {
              clearTimeout(retryTimer.current)
              retryTimer.current = null
            }
          } catch (err) {
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.warn("[push] Unable to register push token", err)
            }
            scheduleRetry()
          }
        }
      } catch (err) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[push] Unable to register push token", err)
        }
        scheduleRetry()
      }
    }

    syncPushToken()

    return () => {
      cancelled = true
      if (retryTimer.current) {
        clearTimeout(retryTimer.current)
        retryTimer.current = null
      }
    }
  }, [
    enabled,
    expoPushToken,
    isAuthenticated,
    profile?.email,
    pushEnabled,
    retryKey,
    setPreferences,
    syncKey,
    isConnected,
    isInternetReachable,
  ])
}
