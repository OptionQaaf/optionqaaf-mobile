// ui/media/Lightbox.tsx
import { Image as ExpoImage } from "expo-image"
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { Dimensions, FlatList, Modal, Pressable, StatusBar, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

type Ctx = {
  open: (images: string[], startIndex?: number) => void
}
const LightboxCtx = createContext<Ctx | null>(null)

export function useLightbox() {
  const ctx = useContext(LightboxCtx)
  if (!ctx) throw new Error("useLightbox must be used within <LightboxProvider>")
  return ctx
}

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [index, setIndex] = useState(0)

  const open = useCallback((imgs: string[], startIndex = 0) => {
    setImages(imgs)
    setIndex(Math.max(0, Math.min(startIndex, imgs.length - 1)))
    setVisible(true)
  }, [])

  const close = useCallback(() => setVisible(false), [])

  const ctx = useMemo<Ctx>(() => ({ open }), [open])

  return (
    <LightboxCtx.Provider value={ctx}>
      {children}
      <LightboxModal visible={visible} images={images} index={index} onClose={close} onIndexChange={setIndex} />
    </LightboxCtx.Provider>
  )
}

/** ---------- ZoomableImage (pinch, pan, double‑tap) ---------- */
function ZoomableImage({ uri, onSettled }: { uri: string; onSettled?: () => void }) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const reset = useCallback(() => {
    "worklet"
    scale.value = withTiming(1)
    savedScale.value = 1
    translateX.value = withTiming(0)
    translateY.value = withTiming(0)
  }, [])

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      // toggle between 1 and 2.2x
      const next = scale.value > 1.5 ? 1 : 2.2
      scale.value = withTiming(next, { duration: 180 })
      savedScale.value = next
      if (next === 1) {
        translateX.value = withTiming(0)
        translateY.value = withTiming(0)
      }
    })

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 4))
    })
    .onEnd(() => {
      savedScale.value = scale.value
      if (savedScale.value === 1) {
        translateX.value = withTiming(0)
        translateY.value = withTiming(0)
      }
    })

  const prevTranslation = useRef({ x: 0, y: 0 })

  const pan = Gesture.Pan()
    .onBegin(() => {
      prevTranslation.current = { x: 0, y: 0 }
    })
    .onUpdate((e) => {
      if (scale.value <= 1.01) return
      const deltaX = e.translationX - prevTranslation.current.x
      const deltaY = e.translationY - prevTranslation.current.y
      translateX.value += deltaX
      translateY.value += deltaY
      prevTranslation.current = { x: e.translationX, y: e.translationY }
    })
    .onEnd(() => {
      // gentle recentre if overscrolled (no hard clamps needed for a simple UX)
      if (scale.value <= 1.01) {
        translateX.value = withTiming(0)
        translateY.value = withTiming(0)
      }
    })

  const composed = Gesture.Simultaneous(doubleTap, Gesture.Simultaneous(pinch, pan))

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }))

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }, aStyle]}
      >
        <ExpoImage
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          onLoadEnd={() => onSettled && onSettled()}
        />
      </Animated.View>
    </GestureDetector>
  )
}

/** ---------- Modal wrapper with horizontal paging ---------- */
function LightboxModal({
  visible,
  images,
  index,
  onClose,
  onIndexChange,
}: {
  visible: boolean
  images: string[]
  index: number
  onClose: () => void
  onIndexChange: (i: number) => void
}) {
  const { width, height } = Dimensions.get("window")
  const listRef = useRef<FlatList<string>>(null)

  // keep FlatList position in sync when opened
  React.useEffect(() => {
    if (visible && listRef.current) {
      setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 0)
    }
  }, [visible, index])

  const keyExtractor = (u: string, i: number) => `${i}-${u}`

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
        {/* Top bar */}
        <View
          style={{
            height: 56,
            alignItems: "center",
            justifyContent: "space-between",
            flexDirection: "row",
            paddingHorizontal: 12,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>
            {images.length ? `${index + 1} / ${images.length}` : ""}
          </Text>
          <Pressable
            hitSlop={16}
            onPress={onClose}
            style={{
              height: 36,
              paddingHorizontal: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>Close</Text>
          </Pressable>
        </View>

        {/* Pager */}
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width, height: height - 56 }}>
              <ZoomableImage uri={item} />
            </View>
          )}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width)
            onIndexChange(i)
          }}
        />
      </View>
    </Modal>
  )
}
