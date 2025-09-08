import { useMenu } from "@/features/navigation/api"
import { routeToPath } from "@/lib/shopify/services/menus"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { Icon } from "@/ui/nav/MenuBar"
import { router } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useMemo, useRef } from "react"
import { Dimensions, Image, Linking, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DrawerContext } from "./drawerContext"

const SCREEN_W = Dimensions.get("window").width
const WIDTH = SCREEN_W // full width

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const x = useSharedValue(-WIDTH)
  const startX = useSharedValue(-WIDTH)
  const isOpenRef = useRef(false)

  const setOpen = (v: boolean) => {
    isOpenRef.current = v
    x.value = withTiming(v ? 0 : -WIDTH, { duration: 240 })
  }
  const open = () => setOpen(true)
  const close = () => setOpen(false)
  const toggle = () => setOpen(!isOpenRef.current)

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value
    })
    .onUpdate((e) => {
      // clamp(startX + translationX, -WIDTH, 0)
      "worklet"
      const next = Math.min(0, Math.max(-WIDTH, startX.value + e.translationX))
      x.value = next
    })
    .onEnd(() => runOnJS(setOpen)(x.value > -WIDTH * 0.5))

  const drawerA = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  const value = useMemo(() => ({ open, close, toggle }), [])

  return (
    <DrawerContext.Provider value={value}>
      <View style={{ flex: 1 }}>{children}</View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, width: WIDTH }, drawerA]}>
          <DrawerContent onNavigate={close} />
        </Animated.View>
      </GestureDetector>
    </DrawerContext.Provider>
  )
}

function DrawerContent({ onNavigate }: { onNavigate: () => void }) {
  const { data } = useMenu("new-menu") // adjust handle if needed
  const insets = useSafeAreaInsets()

  const LOGO_W = 64
  const LOGO_H = 28

  return (
    <Screen>
      {/* header: centered logo + chevron at right */}
      <View className="px-4 pb-6 flex-row items-center justify-between" style={{ paddingTop: insets.top ? 0 : 12 }}>
        <View className="w-6" />
        <Image
          source={require("@/assets/images/optionqaaf-logo.png")}
          style={{ width: LOGO_W, height: LOGO_H }}
          resizeMode="contain"
        />
        <Icon onPress={onNavigate}>
          <ChevronLeft size={24} color="#0B0B0B" />
        </Icon>
      </View>

      {/* big list */}
      <View className="flex-1 px-4 gap-4">
        {(data ?? []).map((item) => (
          <PressableOverlay
            key={item.id}
            onPress={() => {
              const path = routeToPath(item.route)
              if (path.startsWith("http")) {
                Linking.openURL(path)
              } else {
                router.push(path as any)
              }
              onNavigate()
            }}
            className="rounded-2xl px-1 py-1"
          >
            <Text className="text-[32px] leading-[38px] font-extrabold text-primary">{item.title}</Text>
          </PressableOverlay>
        ))}
      </View>

      {/* footer */}
      <View className="px-4 pb-10 pt-8 gap-4">
        <Text className="text-[18px] text-secondary">Shipping Policy</Text>
        <Text className="text-[18px] text-secondary">Terms of Service</Text>
        <Text className="text-[18px] text-secondary">Privacy Policy</Text>
        <Text className="text-[18px] text-secondary">Refund Policy</Text>
      </View>
    </Screen>
  )
}
