import { useFonts } from "expo-font"
import * as SplashScreen from "expo-splash-screen"
import { ReactNode, useCallback } from "react"
import { View } from "react-native"

SplashScreen.preventAutoHideAsync().catch(() => {})

export function FontProvider({ children }: { children: ReactNode }) {
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

  const onLayoutRootView = useCallback(async () => {
    if (loaded) SplashScreen.hideAsync().catch(() => {})
  }, [loaded])

  if (!loaded) return <View style={{ flex: 1, backgroundColor: "black" }} />

  if (error) {
    return <>{children}</>
  }
  return (
    <View onLayout={onLayoutRootView} style={{ flex: 1 }}>
      {children}
    </View>
  )
}
