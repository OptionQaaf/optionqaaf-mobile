import { useCartQuery } from "@/features/cart/api"
import { Icon } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Image } from "expo-image"
import { router } from "expo-router"
import { X } from "lucide-react-native"
import { useCallback, useEffect, useMemo } from "react"
import { Dimensions, ScrollView, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { scheduleOnRN } from "react-native-worklets"

const SCREEN_W = Dimensions.get("window").width
const WIDTH = SCREEN_W

type CartLine = {
  id: string
  quantity?: number | null
  merchandise?: {
    title?: string | null
    image?: { url?: string | null } | null
    product?: {
      title?: string | null
      featuredImage?: { url?: string | null } | null
    } | null
  } | null
}

type Props = {
  open: boolean
  onClose: () => void
}

export function CartPreviewDrawer({ open, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const { data: cart } = useCartQuery()
  const x = useSharedValue(WIDTH)
  const startX = useSharedValue(WIDTH)
  const lines = useMemo(() => ((cart?.lines?.nodes ?? []) as CartLine[]).filter(Boolean), [cart?.lines?.nodes])

  const setOpen = useCallback(
    (value: boolean) => {
      x.value = withTiming(value ? 0 : WIDTH, { duration: 240 })
    },
    [x],
  )

  useEffect(() => {
    setOpen(open)
  }, [open, setOpen])

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value
    })
    .onUpdate((e) => {
      "worklet"
      const next = Math.min(WIDTH, Math.max(0, startX.value + e.translationX))
      x.value = next
    })
    .onEnd((e) => {
      "worklet"
      const startedOpen = startX.value < WIDTH * 0.5
      const shouldOpen = startedOpen
        ? !(x.value > WIDTH * 0.1 || e.velocityX > 300)
        : x.value < WIDTH * 0.9 || e.velocityX < -300
      x.value = withTiming(shouldOpen ? 0 : WIDTH, { duration: 240 })
      if (!shouldOpen) {
        scheduleOnRN(onClose)
      }
    })

  const drawerA = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[{ position: "absolute", right: 0, top: 0, bottom: 0, width: WIDTH, zIndex: 80 }, drawerA]}
      >
        <View
          className="h-full bg-white"
          style={{ width: WIDTH, paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="px-4 pb-3 flex-row items-center justify-between border-b border-[#e5e7eb]">
            <Text className="text-[16px] font-geist-semibold text-[#0f172a]">Cart</Text>
            <Icon onPress={onClose} accessibilityLabel="Close cart preview">
              <X size={22} color="#111827" />
            </Icon>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
            {!lines.length ? (
              <Text className="text-[#64748b] text-[14px]">Your cart is empty.</Text>
            ) : (
              lines.map((line) => {
                const title = line?.merchandise?.product?.title ?? line?.merchandise?.title ?? "Item"
                const quantity = Number(line?.quantity ?? 1)
                const imageUrl = line?.merchandise?.image?.url ?? line?.merchandise?.product?.featuredImage?.url
                return (
                  <View
                    key={line?.id ?? `${title}-${quantity}`}
                    className="rounded-sm border border-[#e5e7eb] px-3 py-3 flex-row items-center gap-3"
                  >
                    <View className="h-14 w-14 rounded-sm overflow-hidden bg-[#f1f5f9] items-center justify-center">
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          contentFit="cover"
                          style={{ width: "100%", height: "100%" }}
                        />
                      ) : (
                        <Text className="text-[#94a3b8] text-[12px]">—</Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-[#0f172a] text-[14px] font-geist-medium" numberOfLines={2}>
                        {title}
                      </Text>
                      <Text className="text-[#64748b] text-[12px] mt-1">Qty {quantity}</Text>
                    </View>
                  </View>
                )
              })
            )}
          </ScrollView>

          <View className="border-t border-[#e5e7eb] px-4 pt-2">
            <Button
              fullWidth
              size="lg"
              onPress={() => {
                onClose()
                router.push("/cart")
              }}
            >
              Go to Cart
            </Button>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  )
}
