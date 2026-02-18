import { router } from "expo-router"
import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { getNotificationSettings } from "@/store/notifications"
import { useCallback, useEffect, useRef } from "react"
import { Linking } from "react-native"
import type * as ExpoNotifications from "expo-notifications"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")

type NotificationData = Record<string, unknown> | undefined

function getTargetFromNotification(data: NotificationData): string | null {
  if (!data) return null

  const path =
    typeof data.path === "string"
      ? data.path
      : typeof data.deepLink === "string"
        ? data.deepLink
        : typeof data.route === "string"
          ? data.route
          : null

  const url = typeof data.url === "string" ? data.url : null

  if (path) return path
  if (url) return url

  if (data.kind === "broadcast") {
    return "/"
  }

  return null
}

function navigateFromNotification(data: NotificationData, opts?: { delayMs?: number }) {
  const target = getTargetFromNotification(data)
  if (!target) return

  const go = () => {
    if (/^https?:\/\//i.test(target)) {
      Linking.openURL(target).catch(() => {})
      return
    }
    router.push(target as any)
  }

  const delay = opts?.delayMs ?? 0
  setTimeout(go, delay)
}

type UseNotificationsServiceOptions = {
  enabled?: boolean
}

export function useNotificationsService({ enabled = true }: UseNotificationsServiceOptions = {}) {
  const handledInitial = useRef(false)
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated && enabled })

  const trackOpen = useCallback(
    async (data: NotificationData) => {
      if (!WORKER_URL) return
      const notificationId = typeof data?.notificationId === "string" ? data.notificationId : null
      if (!notificationId) return
      const { expoPushToken } = getNotificationSettings()

      try {
        await fetch(`${WORKER_URL}/api/track/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationId,
            token: expoPushToken,
            email: isAuthenticated ? (profile?.email ?? null) : null,
          }),
        })
      } catch {
        // ignore tracking errors
      }
    },
    [isAuthenticated, profile?.email],
  )

  useEffect(() => {
    if (!enabled) return
    let mounted = true
    let responseSub: { remove: () => void } | null = null

    const setup = async () => {
      const Notifications = (await import("expo-notifications")) as typeof ExpoNotifications
      if (!mounted) return

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      })

      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined
        trackOpen(data)
        navigateFromNotification(data)
      })

      const getLastAsync =
        typeof (Notifications as typeof Notifications & { getLastNotificationResponseAsync?: () => Promise<any> })
          .getLastNotificationResponseAsync === "function"
          ? (Notifications as typeof Notifications & { getLastNotificationResponseAsync: () => Promise<any> })
              .getLastNotificationResponseAsync
          : null
      const getLastSync =
        typeof Notifications.getLastNotificationResponse === "function"
          ? Notifications.getLastNotificationResponse
          : null
      if (!getLastAsync && !getLastSync) return
      const lastResponse = getLastAsync ? await getLastAsync() : getLastSync ? getLastSync() : null
      if (!mounted || !lastResponse || handledInitial.current) return
      handledInitial.current = true
      const data = lastResponse.notification.request.content.data as Record<string, unknown> | undefined
      trackOpen(data)
      navigateFromNotification(data, {
        delayMs: 50,
      })
    }

    void setup()

    return () => {
      mounted = false
      responseSub?.remove()
    }
  }, [enabled, trackOpen])
}
