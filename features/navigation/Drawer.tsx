import { CURRENCIES, CURRENCIES_MAP } from "@/features/currency/config"
import { useMenu } from "@/features/navigation/api"
import type { AppMenuItem } from "@/lib/shopify/services/menus"
import { routeToPath } from "@/lib/shopify/services/menus"
import { usePrefs } from "@/store/prefs"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { Icon } from "@/ui/nav/MenuBar"
import { router, usePathname } from "expo-router"
import { ChevronLeft, X } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { Dimensions, Image, Linking, ScrollView, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DrawerContext } from "./drawerContext"

const SCREEN_W = Dimensions.get("window").width
const WIDTH = SCREEN_W // full width

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
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
    .onEnd((e) => {
      "worklet"
      const startedOpen = startX.value > -WIDTH * 0.5
      const shouldOpen = startedOpen
        ? // started open: keep open unless user swiped left far/fast
          !(x.value < -WIDTH * 0.1 || e.velocityX < -300)
        : // started closed: open if user swiped right a little/fast
          x.value > -WIDTH * 0.9 || e.velocityX > 300
      runOnJS(setOpen)(!!shouldOpen)
    })

  // Edge pan area to open the drawer when it's closed (left 20px)
  const EDGE_W = 32
  const edgePan = Gesture.Pan()
    .activeOffsetX(10)
    .onBegin(() => {
      // Only respond if currently closed
      if (!isOpenRef.current) startX.value = x.value
    })
    .onUpdate((e) => {
      if (isOpenRef.current) return
      "worklet"
      const next = Math.min(0, Math.max(-WIDTH, startX.value + e.translationX))
      x.value = next
    })
    .onEnd((e) => {
      if (!isOpenRef.current) runOnJS(setOpen)(x.value > -WIDTH * 0.9 || e.velocityX > 300)
    })

  const drawerA = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  const value = useMemo(() => ({ open, close, toggle }), [])

  return (
    <DrawerContext.Provider value={value}>
      <View style={{ flex: 1 }}>{children}</View>

      {/* Left-edge pan catcher to open the drawer (disabled on PDP) */}
      {/^\/products\//.test(pathname) ? null : (
        <GestureDetector gesture={edgePan}>
          <Animated.View
            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: EDGE_W, backgroundColor: "transparent" }}
            // Keep it non-intrusive; it's a small edge area.
            pointerEvents="box-only"
          />
        </GestureDetector>
      )}

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
  const rootItems = Array.isArray(data) ? data : []

  const [levelsStack, setLevelsStack] = useState<{ title: string; items: AppMenuItem[] }[]>([])
  const [displayDepth, setDisplayDepth] = useState(0)

  const baseLevel = useMemo(() => ({ title: "Menu", items: Array.isArray(rootItems) ? rootItems : [] }), [rootItems])
  const levels = useMemo(
    () => [baseLevel, ...(Array.isArray(levelsStack) ? levelsStack : [])],
    [baseLevel, levelsStack],
  )
  // Minimal transition: fade current level
  const fade = useSharedValue(1)
  const fadeA = useAnimatedStyle(() => ({ opacity: fade.value }))
  useEffect(() => {
    fade.value = 0
    fade.value = withTiming(1, { duration: 160 })
  }, [displayDepth])

  const LOGO_W = 64
  const LOGO_H = 28
  const atRoot = displayDepth === 0
  const onHeaderPress = () => {
    if (!atRoot) {
      setLevelsStack((prev) => (Array.isArray(prev) ? prev.slice(0, -1) : []))
      setDisplayDepth((d) => Math.max(0, d - 1))
      return
    }
    // At root: close and fully reset immediately for snappier UX
    onNavigate()
    setLevelsStack([])
    setDisplayDepth(0)
  }
  const closeAndReset = () => {
    onNavigate()
    setTimeout(() => {
      setLevelsStack([])
      setDisplayDepth(0)
    }, 260)
  }

  const onLogoPress = () => {
    router.push("/home")
    closeAndReset()
  }

  return (
    <Screen>
      {/* header: centered logo + chevron at right (back/close) */}
      <View className="px-4 pb-6 flex-row items-center justify-between" style={{ paddingTop: insets.top ? 0 : 12 }}>
        <View className="w-6" />
        <Icon onPress={onLogoPress}>
          <Image
            source={require("@/assets/images/optionqaaf-logo.png")}
            style={{ width: LOGO_W, height: LOGO_H }}
            resizeMode="contain"
          />
        </Icon>
        <Icon onPress={onHeaderPress}>
          {atRoot ? <X size={24} color="#0B0B0B" /> : <ChevronLeft size={24} color="#0B0B0B" />}
        </Icon>
      </View>

      {/* big list (scrollable) with clean fade between levels */}
      <View className="flex-1" style={{ overflow: "hidden" }}>
        {(() => {
          const currentLevelIndex = Math.min(
            Math.max(0, displayDepth),
            Math.max(0, (Array.isArray(levels) ? levels : []).length - 1),
          )
          const level = (Array.isArray(levels) ? levels : [])[currentLevelIndex] ?? baseLevel
          return (
            <Animated.View style={[{ flex: 1 }, fadeA]}>
              <ScrollView>
                <View className="px-4 gap-2">
                  {(Array.isArray(level.items) ? level.items : []).map((item) => (
                    <PressableOverlay
                      key={item.id}
                      onPress={() => {
                        if (item.children && item.children.length > 0) {
                          setLevelsStack((prev) =>
                            Array.isArray(prev)
                              ? [...prev, { title: item.title, items: item.children ?? [] }]
                              : [{ title: item.title, items: item.children ?? [] }],
                          )
                          setDisplayDepth((d) => d + 1)
                          return
                        }
                        const path = routeToPath(item.route)
                        if (path.startsWith("http")) {
                          Linking.openURL(path)
                        } else {
                          router.push(path as any)
                        }
                        closeAndReset()
                      }}
                      className="rounded-2xl px-1 py-1"
                    >
                      <Text className="text-[32px] leading-[38px] font-extrabold text-primary">{item.title}</Text>
                    </PressableOverlay>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          )
        })()}
      </View>

      {/* footer */}
      <DrawerFooter />
    </Screen>
  )
}

function DrawerFooter() {
  const { currency, setPrefs } = usePrefs()
  const [open, setOpen] = useState(false)
  const selected = (currency?.toUpperCase?.() ?? "USD") as keyof typeof CURRENCIES_MAP
  const item = CURRENCIES_MAP[selected] ?? CURRENCIES_MAP.USD

  return (
    <View className="px-4 pb-10 pt-8 gap-4 relative">
      {/* currency selector */}
      {/* legal links */}
      <Text className="text-[18px] text-secondary">Shipping Policy</Text>
      <Text className="text-[18px] text-secondary">Terms of Service</Text>
      <Text className="text-[18px] text-secondary">Privacy Policy</Text>
      <Text className="text-[18px] text-secondary">Refund Policy</Text>

      <View>
        <PressableOverlay
          haptic="light"
          onPress={() => setOpen((v) => !v)}
          className="flex-row items-center justify-between rounded-2xl border border-[#E6E6E6] bg-white px-3 py-3"
        >
          <View className="flex-row items-center gap-2">
            <Text className="text-[20px]">{item.flag}</Text>
            <Text className="text-[18px] font-semibold text-primary">{item.code}</Text>
          </View>
        </PressableOverlay>

        {open ? (
          <View
            className="absolute left-0 right-0 -top-2 translate-y-[-100%] rounded-2xl border border-[#E6E6E6] bg-white"
            style={{ zIndex: 10, elevation: 10 }}
          >
            {CURRENCIES.map((c) => (
              <PressableOverlay
                key={c.code}
                onPress={() => {
                  setPrefs({ currency: c.code })
                  setOpen(false)
                }}
                className="px-3 py-3"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[20px]">{c.flag}</Text>
                    <Text className="text-[16px] font-semibold text-primary">{c.code}</Text>
                  </View>
                </View>
              </PressableOverlay>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}
