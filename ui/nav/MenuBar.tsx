import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { router, usePathname } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import type { ReactNode } from "react"
import { DeviceEventEmitter, Image, View, type StyleProp, type ViewStyle } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

type Props = {
  variant?: "light" | "dark"
  floating?: boolean
  scrim?: number
  back?: boolean
  backIconBackground?: string
}

export function MenuBar({ variant = "light", floating = false, scrim = 0, back = false, backIconBackground }: Props) {
  const color = variant === "dark" ? "#f8f8f8" : "#1e1e1e"
  const pathname = usePathname()

  const LOGO_W = 32
  const LOGO_H = 32

  const Container = floating ? SafeAreaView : View
  const containerProps = floating
    ? ({
        edges: ["top"],
        pointerEvents: "box-none",
        style: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 50, elevation: 50 },
      } as any)
    : ({} as any)

  function onLogoPress() {
    if (pathname === "/home") {
      DeviceEventEmitter.emit("home:scrollToTop")
      return
    }
    router.push("/home")
  }

  return (
    <Container {...containerProps}>
      {floating && scrim > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 64,
            backgroundColor: variant === "light" ? `rgba(0,0,0,${scrim})` : `rgba(255,255,255,${scrim})`,
          }}
        />
      )}

      <View className="flex-row items-center justify-between px-5 py-4">
        <View className="h-10 w-10">
          {back ? (
            <Icon
              onPress={() => router.back()}
              style={
                backIconBackground
                  ? {
                      backgroundColor: backIconBackground,
                    }
                  : undefined
              }
            >
              <ChevronLeft size={24} color={color} />
            </Icon>
          ) : null}
        </View>

        <PressableOverlay onPress={onLogoPress}>
          <Image
            source={require("@/assets/images/optionqaaf-logo.png")}
            style={{ width: LOGO_W, height: LOGO_H }}
            resizeMode="contain"
          />
        </PressableOverlay>

        <View className="h-10 w-10" />
      </View>
    </Container>
  )
}

export function Icon({
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <PressableOverlay
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      className="h-10 w-10 items-center justify-center rounded-2xl"
      style={style}
    >
      {children}
    </PressableOverlay>
  )
}
