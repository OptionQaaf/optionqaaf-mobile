import Constants from "expo-constants"
import type * as ExpoNotifications from "expo-notifications"
import { Platform } from "react-native"

export type PushPermissionsStatus = Awaited<ReturnType<typeof ExpoNotifications.getPermissionsAsync>>

export type PushRegistrationResult = {
  status: PushPermissionsStatus
  granted: boolean
  token: string | null
}

export async function getPushPermissionsStatus(): Promise<PushPermissionsStatus> {
  const Notifications = (await import("expo-notifications")) as typeof ExpoNotifications
  return Notifications.getPermissionsAsync()
}

export async function requestPushPermissionsAndToken(): Promise<PushRegistrationResult> {
  const Notifications = (await import("expo-notifications")) as typeof ExpoNotifications
  let status = await getPushPermissionsStatus()

  if (!status.granted && status.canAskAgain) {
    status = await Notifications.requestPermissionsAsync()
  }

  if (!status.granted) {
    return { status, granted: false, token: null }
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const projectId = Constants?.easConfig?.projectId ?? Constants?.expoConfig?.extra?.eas?.projectId
  try {
    const response = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync()
    return { status, granted: true, token: response.data }
  } catch {
    // Token fetch failed even though permissions are granted; caller should retry without disabling push.
    return { status, granted: true, token: null }
  }
}
