import { requestTrackingPermissionsAsync } from "expo-tracking-transparency"
import { Platform } from "react-native"

let requested = false

function isSupportedIOSVersion() {
  if (Platform.OS !== "ios") return false

  const version = Number(Platform.Version)
  return Number.isFinite(version) && version >= 14
}

export async function requestTrackingAuthorizationIfNeeded() {
  if (requested) return
  requested = true

  if (!isSupportedIOSVersion()) return

  try {
    await requestTrackingPermissionsAsync()
  } catch (error) {
    // Ignored on purpose: this request is informational only.
  }
}
