import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { Image } from "expo-image"
import { useEffect, useMemo, useState } from "react"
import { Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent, PixelRatio, View } from "react-native"

const { width } = Dimensions.get("window")

export function ImageCarousel({
  images,
  height = 420,
  className,
}: {
  images: string[]
  height?: number
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    setIndex(i)
  }

  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const optimized = useMemo(
    () => images.map((u) => optimizeImageUrl(u, { width, height: Math.round(height), format: "webp", dpr }) || u),
    [images, height, dpr],
  )

  useEffect(() => {
    Image.prefetch(optimized.filter(Boolean) as string[])
  }, [optimized])

  return (
    <View className={className}>
      <FlatList
        data={images}
        keyExtractor={(u, i) => `${i}-${u}`}
        renderItem={({ item, index: i }) => (
          <Image
            source={{ uri: optimized[i] || item }}
            style={{ width, height }}
            contentFit="cover"
            transition={i === 0 ? 0 : 200}
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
      />
      <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-2">
        {images.map((_, i) => (
          <View key={i} className={["h-2 rounded-full", i === index ? "w-5 bg-brand" : "w-2 bg-black/30"].join(" ")} />
        ))}
      </View>
    </View>
  )
}
