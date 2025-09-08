import { useDrawer } from "@/features/navigation/drawerContext"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Menu, Search, ShoppingBag, User2 } from "lucide-react-native"
import { Image, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

type Props = {
  variant?: "light" | "dark"
  floating?: boolean
  scrim?: number
}

export function MenuBar({ variant = "light", floating = false, scrim = 0 }: Props) {
  const { toggle } = useDrawer()
  const color = variant === "light" ? "#FFFFFF" : "#0B0B0B"

  const LOGO_W = 56
  const LOGO_H = 24

  const Container = floating ? SafeAreaView : View
  const containerProps = floating
    ? ({
        edges: ["top"],
        pointerEvents: "box-none",
        style: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 50, elevation: 50 },
      } as any)
    : ({} as any)

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
            // 56–64 is a good touch target incl. status bar
            height: 64,
            backgroundColor: variant === "light" ? `rgba(0,0,0,${scrim})` : `rgba(255,255,255,${scrim})`,
          }}
        />
      )}

      <View className="flex-row items-center justify-between px-5 py-4">
        {/* left group */}
        <View className="flex-row items-center gap-4">
          <Icon onPress={toggle}>
            <Menu size={24} color={color} />
          </Icon>
          <Icon onPress={() => {}}>
            <Search size={22} color={color} />
          </Icon>
        </View>

        {/* center logo */}
        <Image
          source={require("@/assets/images/optionqaaf-logo.png")}
          style={{ width: LOGO_W, height: LOGO_H }}
          resizeMode="contain"
        />

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
