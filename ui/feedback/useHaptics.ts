import * as Haptics from "expo-haptics"

export const haptics = {
  impact: {
    light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  },
  selection: () => Haptics.selectionAsync(),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
}

// tiny throttle so we don't spam
let last = 0
const THROTTLE_MS = 50
export function hapticOnce(fn: () => Promise<void>) {
  const now = Date.now()
  if (now - last < THROTTLE_MS) return
  last = now
  void fn()
}
