import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

export type PushPermissionsStatus = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>

export type PushRegistrationResult = {
  status: PushPermissionsStatus
  granted: boolean
  token: string | null
}

export async function requestPushPermissionsAndToken(): Promise<PushRegistrationResult> {
  let status = await Notifications.getPermissionsAsync()

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
