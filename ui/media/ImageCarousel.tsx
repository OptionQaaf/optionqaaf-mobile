import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { Image } from "expo-image"
import { useEffect, useMemo, useState } from "react"
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PixelRatio,
  View,
  type LayoutChangeEvent,
} from "react-native"

const { width: screenWidth } = Dimensions.get("window")

type Props = {
  images: string[]
  height?: number
  width?: number
  className?: string
  onIndexChange?: (index: number) => void
}

export function ImageCarousel({ images, height = 420, width, className, onIndexChange }: Props) {
  const [index, setIndex] = useState(0)
  const [measuredWidth, setMeasuredWidth] = useState(0)

  const validImages = useMemo(() => images.filter((entry) => Boolean(entry?.trim())), [images])
  const resolvedWidth = width && width > 0 ? width : measuredWidth > 0 ? measuredWidth : screenWidth

  useEffect(() => {
    setIndex(0)
  }, [validImages])

  useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!resolvedWidth) return
    const i = Math.round(e.nativeEvent.contentOffset.x / resolvedWidth)
    setIndex(i)
  }

  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const optimized = useMemo(
    () =>
      validImages.map(
        (uri) =>
          optimizeImageUrl(uri, { width: resolvedWidth, height: Math.round(height), format: "webp", dpr }) || uri,
      ),
    [validImages, resolvedWidth, height, dpr],
  )

  useEffect(() => {
    const prefetchBatch = optimized.slice(0, 2).filter(Boolean) as string[]
    if (!prefetchBatch.length) return
    Image.prefetch(prefetchBatch)
  }, [optimized])

  const onLayout = (event: LayoutChangeEvent) => {
    if (width && width > 0) return
    const nextWidth = Math.round(event.nativeEvent.layout.width)
    if (!nextWidth || nextWidth === measuredWidth) return
    setMeasuredWidth(nextWidth)
  }

  return (
    <View className={className} onLayout={onLayout}>
      <FlatList
        data={validImages}
        keyExtractor={(uri, i) => `${i}-${uri}`}
        renderItem={({ item, index: i }) => (
          <Image
            source={{ uri: optimized[i] || item }}
            style={{ width: resolvedWidth, height }}
            contentFit="cover"
            transition={i === 0 ? 0 : 120}
            cachePolicy="disk"
            priority={i === 0 ? "high" : "normal"}
            placeholder={DEFAULT_PLACEHOLDER}
          />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        removeClippedSubviews
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        getItemLayout={(_, i) => ({ length: resolvedWidth, offset: resolvedWidth * i, index: i })}
      />
      {validImages.length > 1 ? (
        <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-2">
          {validImages.map((_, i) => (
            <View
              key={i}
              className={["h-2 rounded-full", i === index ? "w-5 bg-brand" : "w-2 bg-black/30"].join(" ")}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}
