import { BlurView } from "expo-blur"
import { RelativePathString, usePathname, useRouter, useSegments } from "expo-router"
import { type LucideIcon, Home, Menu, Search, ShoppingBag, User2 } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, DeviceEventEmitter, Keyboard, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useCartQuery } from "@/features/cart/api"
import { useDrawer } from "@/features/navigation/drawerContext"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { DOCK_ELEVATION, DOCK_HEIGHT, DOCK_HORIZONTAL_MARGIN, DOCK_MIN_TAB_SIZE } from "./dockConstants"
import { shouldShowDock } from "./dockVisibility"
import { useFloatingDockScaleContext } from "./FloatingDockContext"

type DockTab = {
  key: string
  label: string
  Icon: LucideIcon
  route?: string
  matches?: (pathname: string) => boolean
  action?: () => void
}

const ROUTE_TABS: Omit<DockTab, "action">[] = [
  {
    key: "search",
    label: "Search",
    Icon: Search,
    route: "/search",
    matches: (pathname) => pathname === "/search" || pathname.startsWith("/search"),
  },
  {
    key: "home",
    label: "Home",
    Icon: Home,
    route: "/home",
    matches: (pathname) => pathname === "/" || pathname === "/home" || pathname.startsWith("/home"),
  },
  {
    key: "account",
    label: "Account",
    Icon: User2,
    route: "/account",
    matches: (pathname) => pathname === "/account" || pathname.startsWith("/account"),
  },
  {
    key: "cart",
    label: "Cart",
    Icon: ShoppingBag,
    route: "/cart",
    matches: (pathname) => pathname === "/cart" || pathname.startsWith("/cart"),
  },
]

export function FloatingDock() {
  const pathname = usePathname()
  const segments = useSegments()
  const router = useRouter()
  const { toggle } = useDrawer()
  const insets = useSafeAreaInsets()
  const { data: cart } = useCartQuery()
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const cartRef = useRef<View>(null)
  const dockScale = useRef(new Animated.Value(1)).current
  const scaleContext = useFloatingDockScaleContext()
  const targetScale = scaleContext?.scale ?? 1

  const tabs: DockTab[] = useMemo(
    () => [
      {
        key: "drawer",
        label: "Menu",
        Icon: Menu,
        action: toggle,
      },
      ...ROUTE_TABS,
    ],
    [toggle],
  )

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  const emitCartTarget = useCallback(() => {
    cartRef.current?.measureInWindow((x, y, w, h) => {
      DeviceEventEmitter.emit("cart:iconWindow", { x: x + w / 2, y: y + h / 2 })
    })
  }, [])

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("cart:requestTarget", emitCartTarget)
    return () => sub.remove()
  }, [emitCartTarget])

  useEffect(() => {
    const clamped = Math.min(Math.max(targetScale, 0.3), 1)
    Animated.timing(dockScale, {
      toValue: clamped,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [dockScale, targetScale])

  const bottomOffset = insets.bottom
  const qty = (cart?.totalQuantity ?? 0) > 99 ? 99 : (cart?.totalQuantity ?? 0)
  const containerStyle = {
    position: "absolute" as const,
    left: DOCK_HORIZONTAL_MARGIN,
    right: DOCK_HORIZONTAL_MARGIN,
    bottom: bottomOffset,
    height: DOCK_HEIGHT,
  }

  if (!shouldShowDock(pathname, segments) || keyboardVisible) {
    return null
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      className="items-center justify-center transition-all duration-300"
      style={[containerStyle, { transform: [{ scale: dockScale }] }]}
    >
      <BlurView
        tint="systemUltraThinMaterialDark"
        className="h-full w-full rounded-full flex-row items-center justify-between overflow-hidden"
        intensity={40}
        style={{
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: DOCK_ELEVATION + 6,
        }}
      >
        {/* Glass inner highlight */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.06)",
            },
          ]}
        />

        {tabs.map((tab) => {
          const isActive = Boolean(tab.matches?.(pathname))
          const iconColor = isActive ? "#0f172a" : "#ffffff"

          const handlePress = () => {
            if (tab.action) {
              tab.action()
              return
            }
            if (!tab.route) return
            if (isActive) return
            router.push(tab.route as RelativePathString)
          }

          const isCart = tab.key === "cart"

          return (
            <PressableOverlay
              key={tab.key}
              onPress={handlePress}
              accessibilityLabel={tab.label}
              className="flex-1 items-center justify-center"
              style={{ minWidth: DOCK_MIN_TAB_SIZE }}
            >
              <View
                ref={isCart ? cartRef : null}
                onLayout={isCart ? emitCartTarget : undefined}
                className={`h-[44px] w-[56px] items-center justify-center rounded-[48px] ${
                  isActive ? "bg-white/70" : ""
                }`}
                style={
                  isActive
                    ? {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.08,
                        shadowRadius: 4,
                      }
                    : undefined
                }
              >
                <tab.Icon size={24} color={iconColor} />
                {isCart && qty > 0 ? (
                  <View className="absolute right-4 top-2 aspect-square min-w-4 px-1 items-center justify-center rounded-full bg-brand">
                    <Text className="text-[10px] text-white font-geist-semibold" numberOfLines={1}>
                      {qty}
                      {qty === 99 ? "+" : ""}
                    </Text>
                  </View>
                ) : null}
              </View>
            </PressableOverlay>
          )
        })}
      </BlurView>
    </Animated.View>
  )
}
