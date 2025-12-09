import { Redirect, Slot } from "expo-router"

export default function TestLayout() {
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    return <Redirect href="/" />
  }
  return <Slot />
}
