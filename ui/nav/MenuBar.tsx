import { useCartQuery } from "@/features/cart/api"
import { useDrawer } from "@/features/navigation/drawerContext"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { router, usePathname } from "expo-router"
import { ChevronLeft, Menu, Search, ShoppingBag, User2 } from "lucide-react-native"
import { useEffect, useRef } from "react"
import { DeviceEventEmitter, Image, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

type Props = {
  variant?: "light" | "dark"
  floating?: boolean
  scrim?: number
  back?: boolean
}

export function MenuBar({ variant = "light", floating = false, scrim = 0, back = false }: Props) {
  const { toggle } = useDrawer()
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
          <Icon onPress={() => router.push("/(account)" as any)}>
            <View>
              <User2 size={22} color={color} />
            </View>
          </Icon>
          <CartIcon color={color} />
        </View>
      </View>
    </Container>
  )
}

export function Icon({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode
  onPress?: () => void
  accessibilityLabel?: string
}) {
  return (
    <PressableOverlay
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      className="h-10 w-10 items-center justify-center rounded-2xl"
    >
      {children}
    </PressableOverlay>
  )
}

function CartIcon({ color }: { color: string }) {
  const { data: cart } = useCartQuery()
  const qty = cart?.totalQuantity ?? 0
  const ref = useRef<View>(null)
  const onLayout = () => {
    // measure in window coordinates for global overlay animations
    ref.current?.measureInWindow?.((x: number, y: number, w: number, h: number) => {
      DeviceEventEmitter.emit("cart:iconWindow", { x: x + w / 2, y: y + h / 2 })
    })
  }
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("cart:requestTarget", () => onLayout())
    return () => sub.remove()
  }, [])

  return (
    <View ref={ref} onLayout={onLayout}>
      <PressableOverlay
        onPress={() => router.push("/cart" as any)}
        className="h-10 w-10 items-center justify-center rounded-2xl"
      >
        <ShoppingBag size={22} color={color} />
        {qty > 0 ? (
          <View
            style={{ position: "absolute", right: 2, top: 2 }}
            className="min-w-[16px] h-[16px] px-[3px] rounded-full bg-brand items-center justify-center"
          >
            <Text className="text-[10px] text-white font-geist-semibold" numberOfLines={1}>
              {qty}
            </Text>
          </View>
        ) : null}
      </PressableOverlay>
    </View>
  )
}
