import { I18nManager } from "react-native"

export const isRTL = () => I18nManager.isRTL

// 44pt min touch target; add padding around small icons etc.
export const hitTarget = 10 as const // you can bump to 12 if you like

export function a11yButton(label?: string, disabled?: boolean) {
  return {
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: label,
    accessibilityState: { disabled: !!disabled },
  }
}

export function a11yAlert() {
  return {
    accessible: true,
    accessibilityRole: "alert" as const,
    // Android only: have screen reader announce changes
    accessibilityLiveRegion: "polite" as const,
    // iOS VoiceOver reads alerts by default when focused
  }
}
