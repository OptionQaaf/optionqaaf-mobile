import { useDrawer } from "@/features/navigation/drawerContext"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { router, usePathname } from "expo-router"
import { ChevronLeft, Menu, Search, ShoppingBag, User2 } from "lucide-react-native"
import { DeviceEventEmitter, Image, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

type Props = {
  variant?: "light" | "dark"
  floating?: boolean
  scrim?: number
  back?: boolean
}

export function MenuBar({ variant = "light", floating = false, scrim = 0, back = false }: Props) {
  const { toggle } = useDrawer()
  const color = "#1e1e1e"
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
        {/* left group */}
        <View className="flex-row items-center gap-4">
          {back ? (
            <Icon onPress={() => router.back()}>
              <ChevronLeft size={24} color={color} />
            </Icon>
          ) : (
            <Icon onPress={toggle}>
              <Menu size={24} color={color} />
            </Icon>
          )}
          <Icon onPress={() => router.push("/search" as any)}>
            <Search size={22} color={color} />
          </Icon>
        </View>

        {/* center logo */}
        <PressableOverlay onPress={onLogoPress}>
          <Image
            source={require("@/assets/images/optionqaaf-logo.png")}
            style={{ width: LOGO_W, height: LOGO_H }}
            resizeMode="contain"
          />
        </PressableOverlay>

        {/* right group */}
        <View className="flex-row items-center gap-4">
          <Icon onPress={() => {}}>
            <User2 size={22} color={color} />
          </Icon>
          <Icon onPress={() => {}}>
            <ShoppingBag size={22} color={color} />
          </Icon>
        </View>
      </View>
    </Container>
  )
}

export function Icon({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <PressableOverlay onPress={onPress} className="h-10 w-10 items-center justify-center rounded-2xl">
      {children}
    </PressableOverlay>
  )
}
