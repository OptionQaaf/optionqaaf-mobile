import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { router, usePathname, useRouter } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import type { ReactNode } from "react"
import { DeviceEventEmitter, Image, View, type ViewStyle } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

type Props = {
  variant?: "light" | "dark"
  floating?: boolean
  scrim?: number
  back?: boolean
  backIconBackground?: string
}

export function MenuBar({ variant = "light", floating = false, scrim = 0, back = false, backIconBackground }: Props) {
  const color = "#1e1e1e"
  const pathname = usePathname()
  const navigation = useRouter()

  const Container = floating ? SafeAreaView : View
  const containerProps = floating
    ? ({
        edges: ["top"],
        pointerEvents: "box-none",
        className: "absolute left-0 right-0 top-0 z-50 bg-white",
        style: { elevation: 50 },
      } as any)
    : ({ className: "bg-white" } as any)

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
          className="absolute left-0 right-0 top-0 h-16"
          style={{ backgroundColor: variant === "light" ? `rgba(0,0,0,${scrim})` : `rgba(255,255,255,${scrim})` }}
        />
      )}

      <View className="flex-row items-center justify-between px-4 py-1">
        <View className="h-10 w-10">
          {back && navigation.canGoBack() ? (
            <Icon onPress={() => router.back()}>
              <ChevronLeft size={24} color={color} />
            </Icon>
          ) : null}
        </View>

        <PressableOverlay onPress={onLogoPress}>
          <Image source={require("@/assets/images/optionqaaf-logo.png")} className="h-8 w-8" resizeMode="contain" />
        </PressableOverlay>

        <View className="h-10 w-10" />
      </View>

      <View className="h-px bg-[#e5e7eb]" />
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
  style?: ViewStyle | ViewStyle[]
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
