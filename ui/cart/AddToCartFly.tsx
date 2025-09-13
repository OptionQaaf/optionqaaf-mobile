import { DeviceEventEmitter, EmitterSubscription } from "react-native"
import { Image } from "expo-image"
import { useEffect, useRef, useState } from "react"
import { Animated, Dimensions, Easing, View } from "react-native"

type FlyPayload = {
  image?: string
  // Absolute screen coordinates (center point of source)
  from?: { x: number; y: number }
}

export function AddToCartFlyOverlay() {
  const SIZE = 28
  const R = SIZE / 2
  // cart icon center (absolute screen coords)
  const [icon, setIcon] = useState<{ x: number; y: number }>({ x: Dimensions.get("window").width - 28, y: 28 })
  const [shot, setShot] = useState<FlyPayload | null>(null)
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const scale = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const subs: EmitterSubscription[] = []
    subs.push(
      DeviceEventEmitter.addListener("cart:iconLayout", (e: any) => {
        if (e && typeof e.x === "number" && typeof e.y === "number") setIcon({ x: e.x, y: e.y })
      }),
    )
    subs.push(
      DeviceEventEmitter.addListener("cart:fly", (p: FlyPayload) => {
        const startCenter = p?.from ?? { x: Dimensions.get("window").width / 2, y: Dimensions.get("window").height - 80 }
        // Convert center points to top-left for the animated view (so the image centers on the points)
        const start = { x: startCenter.x - R, y: startCenter.y - R }
        const target = { x: icon.x - R, y: icon.y - R }
        setShot({ image: p.image, from: startCenter })
        // Set starting position precisely
        pos.x.setValue(start.x)
        pos.y.setValue(start.y)
        scale.setValue(0.7)
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
          Animated.timing(pos.x, {
            toValue: target.x,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(pos.y, {
            toValue: target.y,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShot(null)
        })
      }),
    )
    return () => subs.forEach((s) => s.remove())
  }, [icon])

  if (!shot) return null
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 100 }}>
      <Animated.View style={{ position: "absolute", transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale }] }}>
        <Image source={{ uri: shot.image }} style={{ width: SIZE, height: SIZE, borderRadius: R, backgroundColor: "#eee" }} />
      </Animated.View>
    </View>
  )
}
