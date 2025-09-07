import { useState } from "react"
import { Dimensions, FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, View } from "react-native"

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

  return (
    <View className={className}>
      <FlatList
        data={images}
        keyExtractor={(u, i) => `${i}-${u}`}
        renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height }} />}
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
