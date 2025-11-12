import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import type { PosterCell, SectionSize } from "@/lib/shopify/services/home"
import { Image } from "expo-image"
import { memo, useState } from "react"
import { Dimensions, Pressable, View } from "react-native"
import Carousel from "react-native-reanimated-carousel"
import { sizeScale } from "../sectionSize"

type CarouselItem = Pick<PosterCell, "image" | "url">

type Props = {
  items?: CarouselItem[]
  height?: number
  onPressItem?: (url: string | undefined, index: number) => void
  size?: SectionSize
}

const { width: screenWidth } = Dimensions.get("window")

export const ImageCarouselSection = memo(function ImageCarouselSection({ items = [], height, onPressItem, size }: Props) {
  const slides = (items ?? []).filter((x) => x.image?.url)
  const [activeIndex, setActiveIndex] = useState(0)

  if (!slides.length) return null

  const scale = sizeScale(size)
  const slideHeight =
    typeof height === "number" && Number.isFinite(height)
      ? Math.max(200, height * scale)
      : Math.round(Math.min(Math.max(screenWidth * 0.85, 340), 520) * scale)

  const optimized = slides.map(
    (item) =>
      optimizeImageUrl(item.image?.url, {
        width: Math.round(screenWidth),
        height: Math.round(slideHeight),
        format: "webp",
        dpr: 2,
      }) ?? item.image?.url,
  )

  return (
    <View className="w-full items-center">
      <Carousel
        width={screenWidth}
        height={slideHeight}
        data={slides}
        loop
        autoPlay
        autoPlayInterval={4500}
        pagingEnabled
        scrollAnimationDuration={700}
        onSnapToItem={(index) => setActiveIndex(index)}
        renderItem={({ item, index }) => {
          const uri = optimized[index]
          return (
            <Pressable
              className="w-full"
              style={{ height: slideHeight }}
              onPress={() => onPressItem?.(item.url, index)}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={index === 0 ? 0 : 200}
                  placeholder={DEFAULT_PLACEHOLDER}
                />
              ) : (
                <View className="flex-1 bg-gray-200" />
              )}
            </Pressable>
          )
        }}
      />

      {/* pagination dots */}
      {slides.length > 1 && (
        <View className="absolute bottom-4 left-0 right-0 flex-row items-center justify-center gap-2">
          {slides.map((_, i) => {
            const isActive = i === activeIndex
            return (
              <View
                key={`dot-${i}`}
                className={["h-2 rounded-full", isActive ? "w-5 bg-brandAccent" : "w-2 bg-brandAccent/40"].join(" ")}
              />
            )
          })}
        </View>
      )}
    </View>
  )
})
