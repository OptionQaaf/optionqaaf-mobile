// features/navigation/Drawer.tsx
import { CURRENCIES, CURRENCIES_MAP } from "@/features/currency/config"
import { useMenu } from "@/features/navigation/api"
import type { AppMenuItem } from "@/lib/shopify/services/menus"
import { routeToPath } from "@/lib/shopify/services/menus"
import { usePrefs } from "@/store/prefs"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { defaultKeyboardShouldPersistTaps, verticalScrollProps } from "@/ui/layout/scrollDefaults"
import { Icon } from "@/ui/nav/MenuBar"
import { useQueryClient } from "@tanstack/react-query"
import { router, usePathname } from "expo-router"
import { ChevronLeft, RefreshCcw, X } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { Dimensions, Image, Linking, ScrollView, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DrawerContext } from "./drawerContext"

const SCREEN_W = Dimensions.get("window").width
const WIDTH = SCREEN_W

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const x = useSharedValue(-WIDTH)
  const startX = useSharedValue(-WIDTH)
  const isOpen = useSharedValue(false)

  const setOpen = (v: boolean) => {
    isOpen.value = v
    x.value = withTiming(v ? 0 : -WIDTH, { duration: 240 })
  }
  const open = () => setOpen(true)
  const close = () => setOpen(false)
  const toggle = () => setOpen(!isOpen.value)

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value
    })
    .onUpdate((e) => {
      "worklet"
      const next = Math.min(0, Math.max(-WIDTH, startX.value + e.translationX))
      x.value = next
    })
    .onEnd((e) => {
      "worklet"
      const startedOpen = startX.value > -WIDTH * 0.5
      const shouldOpen = startedOpen
        ? !(x.value < -WIDTH * 0.1 || e.velocityX < -300)
        : x.value > -WIDTH * 0.9 || e.velocityX > 300
      isOpen.value = !!shouldOpen
      x.value = withTiming(shouldOpen ? 0 : -WIDTH, { duration: 240 })
    })

  const EDGE_W = 32
  const edgePan = Gesture.Pan()
    .activeOffsetX(10)
    .onBegin(() => {
      if (!isOpen.value) startX.value = x.value
    })
    .onUpdate((e) => {
      "worklet"
      if (isOpen.value) return
      const next = Math.min(0, Math.max(-WIDTH, startX.value + e.translationX))
      x.value = next
    })
    .onEnd((e) => {
      if (!isOpen.value) {
        const shouldOpen = x.value > -WIDTH * 0.9 || e.velocityX > 300
        isOpen.value = !!shouldOpen
        x.value = withTiming(shouldOpen ? 0 : -WIDTH, { duration: 240 })
      }
    })

  const drawerA = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const value = useMemo(() => ({ open, close, toggle }), [])

  const DISABLED_EDGE_PAN_PATHS = [/^\/products\//, /^\/checkout\//, /^\/account\//, /^\/collections/]
  const isEdgePanDisabled = DISABLED_EDGE_PAN_PATHS.some((rx) => rx.test(pathname))

  return (
    <DrawerContext.Provider value={value}>
      <View style={{ flex: 1 }}>{children}</View>

      {isEdgePanDisabled ? null : (
        <GestureDetector gesture={edgePan}>
          <Animated.View
            style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: EDGE_W, backgroundColor: "transparent" }}
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
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()

  const { data, fetchStatus, isLoading, isError, error, refetch } = useMenu("new-menu")
  const isUninitialized = data === undefined && fetchStatus === "idle"
  const showSkeleton = isUninitialized || isLoading || fetchStatus === "fetching"
  const rootItems = Array.isArray(data) ? data : []
  const showEmpty = !showSkeleton && rootItems.length === 0

  useEffect(() => {
    if (!isLoading && rootItems?.length === 0) {
      // eslint-disable-next-line no-console
      console.warn("[Drawer] Menu empty. isError:", isError, "error:", error)
    }
  }, [isLoading, rootItems?.length, isError, error])

  const [levelsStack, setLevelsStack] = useState<{ title: string; items: AppMenuItem[] }[]>([])
  const [displayDepth, setDisplayDepth] = useState(0)

  const baseLevel = useMemo(() => ({ title: "Menu", items: rootItems }), [rootItems])
  const levels = useMemo(() => [baseLevel, ...levelsStack], [baseLevel, levelsStack])

  // Minimal transition: fade current level (only when depth changes)
  const fade = useSharedValue(1)
  const fadeA = useAnimatedStyle(() => ({ opacity: fade.value }))
  useEffect(() => {
    fade.value = 0
    fade.value = withTiming(1, { duration: 160 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayDepth])

  const LOGO_W = 64
  const LOGO_H = 28
  const atRoot = displayDepth === 0
  const onHeaderPress = () => {
    if (!atRoot) {
      setLevelsStack((prev) => prev.slice(0, -1))
      setDisplayDepth((d) => Math.max(0, d - 1))
      return
    }
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

  // UI helpers
  const MenuSkeleton = () => (
    <View className="px-4 gap-3">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-9 rounded-2xl" />
      ))}
    </View>
  )

  const EmptyState = ({ onRetry }: { onRetry: () => void }) => (
    <View className="px-4 py-6 items-center gap-3">
      <Text className="text-[16px] text-secondary text-center">We couldn’t load the menu right now.</Text>
      <PressableOverlay haptic="light" onPress={onRetry} className="rounded-2xl bg-black px-4 py-3">
        <View className="flex-row items-center gap-2">
          <RefreshCcw size={18} color="#fff" />
          <Text className="text-white text-[16px] font-semibold">Retry</Text>
        </View>
      </PressableOverlay>
    </View>
  )

  return (
    <Screen>
      {/* header */}
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

      {/* body */}
      <View className="flex-1" style={{ overflow: "hidden" }}>
        <Animated.View style={[{ flex: 1 }, fadeA]}>
          {showSkeleton ? (
            <ScrollView {...verticalScrollProps} keyboardShouldPersistTaps={defaultKeyboardShouldPersistTaps}>
              <MenuSkeleton />
            </ScrollView>
          ) : showEmpty ? (
            <EmptyState
              onRetry={() => {
                queryClient.removeQueries({ queryKey: ["menu", "new-menu"] })
                refetch()
              }}
            />
          ) : (
            (() => {
              const currentLevelIndex = Math.min(Math.max(0, displayDepth), Math.max(0, levels.length - 1))
              const level = levels[currentLevelIndex] ?? baseLevel
              return (
                <ScrollView
                  {...verticalScrollProps}
                  keyboardShouldPersistTaps={defaultKeyboardShouldPersistTaps}
                  showsVerticalScrollIndicator={false}
                >
                  <View className="px-4 gap-2">
                    {level.items?.map((item) => (
                      <PressableOverlay
                        key={item.id}
                        onPress={() => {
                          if (item.children && item.children.length > 0) {
                            setLevelsStack((prev) => [...prev, { title: item.title, items: item.children ?? [] }])
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
              )
            })()
          )}
        </Animated.View>
      </View>

      {/* footer */}
      <DrawerFooter onNavigate={closeAndReset} />
    </Screen>
  )
}

function DrawerFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { currency, setPrefs } = usePrefs()
  const [open, setOpen] = useState(false)
  const selected = (currency?.toUpperCase?.() ?? "USD") as keyof typeof CURRENCIES_MAP
  const item = CURRENCIES_MAP[selected] ?? CURRENCIES_MAP.USD

  const policyLinks = [
    { label: "Shipping Policy", path: "/policies/shipping-policy" },
    { label: "Terms of Service", path: "/policies/terms-of-service" },
    { label: "Privacy Policy", path: "/policies/privacy-policy" },
    { label: "Refund Policy", path: "/policies/refund-policy" },
  ]

  const handlePolicyPress = (path: string) => {
    router.push(path as any)
    onNavigate?.()
  }

  return (
    <View className="px-4 pb-10 pt-8 gap-4 relative">
      {/* currency selector */}
      {/* legal links */}
      <View className="gap-2">
        {policyLinks.map((link) => (
          <PressableOverlay
            key={link.path}
            onPress={() => handlePolicyPress(link.path)}
            className="rounded-2xl px-1 py-1"
            accessibilityLabel={`Open ${link.label}`}
          >
            <Text className="text-[18px] text-secondary font-geist-medium">{link.label}</Text>
          </PressableOverlay>
        ))}
      </View>

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
