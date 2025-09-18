import React, { useEffect } from "react"
import { DeviceEventEmitter, View } from "react-native"
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { create } from "zustand"
import { Image } from "expo-image"

type FlyItem = {
  id: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  image?: string
  size: number
}

type Store = {
  target: { x: number; y: number } | null
  items: FlyItem[]
  setTarget: (x: number, y: number) => void
  push: (i: Omit<FlyItem, "id" | "targetX" | "targetY">) => void
  remove: (id: number) => void
}

let seq = 1

export const useFlyToCartStore = create<Store>((set, get) => ({
  target: null,
  items: [],
  setTarget: (x, y) => set({ target: { x, y } }),
  push: (i) => {
    const t = get().target
    if (!t) return
    const id = seq++
    const item: FlyItem = { id, startX: i.startX, startY: i.startY, targetX: t.x, targetY: t.y, image: i.image, size: i.size }
    set((s) => ({ items: [...s.items, item] }))
  },
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}))

export function setFlyTarget(x: number, y: number) {
  useFlyToCartStore.getState().setTarget(x, y)
}

export async function measureRefInWindow(ref: any): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (!ref?.current || !ref.current?.measureInWindow) return resolve(null)
    ref.current.measureInWindow((x: number, y: number, w: number, h: number) => resolve({ x, y, w, h }))
  })
}

export async function flyToCartFromRef(ref: any, image?: string, size = 40) {
  const rect = await measureRefInWindow(ref)
  const target = useFlyToCartStore.getState().target
  if (!rect || !target) return
  const startX = rect.x + rect.w / 2
  const startY = rect.y + rect.h / 2
  useFlyToCartStore.getState().push({ startX, startY, image, size })
}

export function FlyToCartHost() {
  const items = useFlyToCartStore((s) => s.items)
  const setTarget = useFlyToCartStore((s) => s.setTarget)

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("cart:iconWindow", (p: { x: number; y: number }) => {
      setTarget(p.x, p.y)
    })
    // Request current target in case the icon laid out before host mounted
    DeviceEventEmitter.emit("cart:requestTarget")
    return () => sub.remove()
  }, [setTarget])

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 60 }}>
      {items.map((it) => (
        <FlyAnim key={it.id} item={it} />
      ))}
    </View>
  )
}

function FlyAnim({ item }: { item: FlyItem }) {
  const t = useSharedValue(0)
  const remove = useFlyToCartStore((s) => s.remove)

  useEffect(() => {
    t.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) remove(item.id)
    })
  }, [item.id])

  const style = useAnimatedStyle(() => {
    const P0x = item.startX
    const P0y = item.startY
    const P1x = item.targetX
    const P1y = item.targetY
    // control point: above the straight line for a nice arc
    const Cx = (P0x + P1x) / 2
    const Cy = Math.min(P0y, P1y) - 120
    const u = 1 - t.value
    const x = u * u * P0x + 2 * u * t.value * Cx + t.value * t.value * P1x
    const y = u * u * P0y + 2 * u * t.value * Cy + t.value * t.value * P1y
    const scale = 1 - 0.5 * t.value
    const opacity = 1 - 0.2 * t.value
    return {
      transform: [{ translateX: x - item.size / 2 }, { translateY: y - item.size / 2 }, { scale }],
      opacity,
    }
  })

  return (
    <Animated.View style={[{ position: "absolute", width: item.size, height: item.size, borderRadius: item.size / 2, overflow: "hidden", backgroundColor: "#eee" }, style]}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : null}
    </Animated.View>
  )
}
