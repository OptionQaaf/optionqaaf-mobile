import { useFonts } from "expo-font"
import { ReactNode, useEffect } from "react"
import { View } from "react-native"

export function FontProvider({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const [loaded, error] = useFonts({
    "Geist-Black": require("@/assets/fonts/Geist/Geist-Black.ttf"),
    "Geist-Bold": require("@/assets/fonts/Geist/Geist-Bold.ttf"),
    "Geist-ExtraBold": require("@/assets/fonts/Geist/Geist-ExtraBold.ttf"),
    "Geist-ExtraLight": require("@/assets/fonts/Geist/Geist-ExtraLight.ttf"),
    "Geist-Light": require("@/assets/fonts/Geist/Geist-Light.ttf"),
    "Geist-Medium": require("@/assets/fonts/Geist/Geist-Medium.ttf"),
    Geist: require("@/assets/fonts/Geist/Geist-Regular.ttf"),
    "Geist-SemiBold": require("@/assets/fonts/Geist/Geist-SemiBold.ttf"),
    "Geist-Thin": require("@/assets/fonts/Geist/Geist-Thin.ttf"),
  })

  useEffect(() => {
    if (loaded) onReady?.()
  }, [loaded])

  if (!loaded) return <View style={{ flex: 1, backgroundColor: "black" }} />

  if (error) {
    return <>{children}</>
  }
  return <View style={{ flex: 1 }}>{children}</View>
}
