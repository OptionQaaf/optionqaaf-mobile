import { Platform } from "react-native"
import type { ScrollViewProps } from "react-native"

const iosProps: Pick<ScrollViewProps, "bounces" | "alwaysBounceVertical"> = {
  bounces: false,
  alwaysBounceVertical: false,
}

const androidProps: Pick<ScrollViewProps, "overScrollMode"> = {
  overScrollMode: "never",
}

export const verticalScrollProps: Partial<ScrollViewProps> =
  Platform.OS === "ios" ? iosProps : Platform.OS === "android" ? androidProps : {}

export const defaultKeyboardShouldPersistTaps: ScrollViewProps["keyboardShouldPersistTaps"] = "handled"
