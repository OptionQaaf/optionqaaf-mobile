import * as Notifications from "expo-notifications"
import { router } from "expo-router"
import { useEffect, useRef } from "react"
import { Linking } from "react-native"

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

  useEffect(() => {
    let mounted = true

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotification(response.notification.request.content.data as Record<string, unknown> | undefined)
    })

    const checkInitial = async () => {
      const getLast = typeof Notifications.getLastNotificationResponse === "function"
      if (!getLast) return
      const lastResponse = await Notifications.getLastNotificationResponse()
      if (!mounted || !lastResponse || handledInitial.current) return
      handledInitial.current = true
      navigateFromNotification(lastResponse.notification.request.content.data as Record<string, unknown> | undefined, {
        delayMs: 50,
      })
    }

    checkInitial()

    return () => {
      mounted = false
      responseSub.remove()
    }
  }, [])
}
