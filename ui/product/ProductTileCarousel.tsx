import { DEFAULT_PLACEHOLDER } from "@/lib/images/optimize"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { Image } from "expo-image"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { LayoutChangeEvent, View } from "react-native"
import type { PanGesture } from "react-native-gesture-handler"
import Carousel from "react-native-reanimated-carousel"

type Props = {
  images: string[]
  width: number
  height: number
  priority?: "low" | "normal" | "high"
}

export const ProductTileCarousel = memo(function ProductTileCarousel({ images, width, height, priority }: Props) {
  const [imageIndex, setImageIndex] = useState(0)
  const [layout, setLayout] = useState({ width, height })
  const loadedIndexes = useRef<Set<number>>(new Set())
  const [, forceUpdate] = useState(0)
  const showDots = images.length > 1
  const resolvedPriority = priority ?? (width > 0 ? "normal" : "low")

  const configurePanGesture = useMemo(
    () => (gesture: PanGesture) => {
      gesture.activeOffsetX([-12, 12]).failOffsetY([-12, 12])
    },
    [],
  )

  useEffect(() => {
    setLayout({ width, height })
  }, [width, height])

  useEffect(() => {
    loadedIndexes.current = new Set()
    setImageIndex(0)
    forceUpdate((value) => value + 1)
  }, [images])

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width)
    const nextHeight = Math.round(event.nativeEvent.layout.height)
    if (!nextWidth || !nextHeight) return
    if (nextWidth === layout.width && nextHeight === layout.height) return
    setLayout({ width: nextWidth, height: nextHeight })
  }

  return (
    <View className="w-full h-full" onLayout={onLayout}>
      <Carousel
        width={layout.width}
        height={layout.height}
        data={images}
        loop={false}
        pagingEnabled
        snapEnabled
        windowSize={3}
        scrollAnimationDuration={220}
        onSnapToItem={setImageIndex}
        onConfigurePanGesture={configurePanGesture}
        renderItem={({ item, index }) => {
          const isLoaded = loadedIndexes.current.has(index)
          return (
            <View className="w-full h-full">
              <Image
                source={{ uri: item }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={priority === "high" || index === 0 ? 0 : 150}
                cachePolicy="disk"
                priority={resolvedPriority}
                placeholder={DEFAULT_PLACEHOLDER}
                onLoadEnd={() => {
                  if (loadedIndexes.current.has(index)) return
                  loadedIndexes.current.add(index)
                  if (index === imageIndex) {
                    forceUpdate((value) => value + 1)
                  }
                }}
              />
              {!isLoaded ? (
                <View className="absolute inset-0">
                  <Skeleton className="w-full h-full" />
                </View>
              ) : null}
            </View>
          )
        }}
      />

      {showDots ? (
        <View className="absolute bottom-1.5 left-0 right-0 items-center justify-center">
          <View className="flex-row items-center gap-1 px-1.5 py-0.5 bg-black/15 rounded-full">
            {images.map((_, idx) => (
              <View
                key={`dot-${idx}`}
                className={`h-1 w-1 rounded-full ${idx === imageIndex ? "bg-white/60" : "bg-white/25"}`}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
})
