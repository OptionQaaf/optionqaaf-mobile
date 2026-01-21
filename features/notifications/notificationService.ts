import * as Notifications from "expo-notifications"
import { router } from "expo-router"
import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { getNotificationSettings } from "@/store/notifications"
import { useCallback, useEffect, useRef } from "react"
import { Linking } from "react-native"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

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

export function useNotificationsService() {
  const handledInitial = useRef(false)
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated })

  const trackOpen = useCallback(
    async (data: NotificationData) => {
      if (!WORKER_URL) return
      const notificationId = typeof data?.notificationId === "string" ? data.notificationId : null
      if (!notificationId) return
      const { expoPushToken } = getNotificationSettings()
      if (!expoPushToken) return

      try {
        await fetch(`${WORKER_URL}/api/track/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationId,
            token: expoPushToken,
            email: isAuthenticated ? profile?.email ?? null : null,
          }),
        })
      } catch {
        // ignore tracking errors
      }
    },
    [isAuthenticated, profile?.email],
  )

  useEffect(() => {
    let mounted = true

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined
      trackOpen(data)
      navigateFromNotification(data)
    })

    const checkInitial = async () => {
      const getLast = typeof Notifications.getLastNotificationResponse === "function"
      if (!getLast) return
      const lastResponse = await Notifications.getLastNotificationResponse()
      if (!mounted || !lastResponse || handledInitial.current) return
      handledInitial.current = true
      const data = lastResponse.notification.request.content.data as Record<string, unknown> | undefined
      trackOpen(data)
      navigateFromNotification(data, {
        delayMs: 50,
      })
    }

    checkInitial()

    return () => {
      mounted = false
      responseSub.remove()
    }
  }, [trackOpen])
}
