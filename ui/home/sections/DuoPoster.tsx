import { Pressable, View, PixelRatio } from "react-native"
import { Image } from "expo-image"
import { optimizeImageUrl, DEFAULT_PLACEHOLDER } from "@/lib/images/optimize"

type Item = { image?: { url: string }; url?: string }
type Props = { left?: Item; right?: Item; onPressLeft?: () => void; onPressRight?: () => void }

export function DuoPoster({ left, right, onPressLeft, onPressRight }: Props) {
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  return (
    <View className="w-full flex-row">
      <Pressable onPress={onPressLeft} className="flex-1">
        {!!left?.image?.url && (
          <Image
            source={{
              uri:
                optimizeImageUrl(left.image.url, { width: 540, height: 220, format: "webp", dpr }) || left.image.url,
            }}
            className="h-[220px] w-full"
            contentFit="cover"
            transition={150}
            cachePolicy="disk"
            placeholder={DEFAULT_PLACEHOLDER}
          />
        )}
      </Pressable>
      <Pressable onPress={onPressRight} className="flex-1">
        {!!right?.image?.url && (
          <Image
            source={{
              uri:
                optimizeImageUrl(right.image.url, { width: 540, height: 220, format: "webp", dpr }) || right.image.url,
            }}
            className="h-[220px] w-full"
            contentFit="cover"
            transition={150}
            cachePolicy="disk"
            placeholder={DEFAULT_PLACEHOLDER}
          />
        )}
      </Pressable>
    </View>
  )
}
