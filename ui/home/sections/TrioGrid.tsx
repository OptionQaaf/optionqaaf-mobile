import { Pressable, View, PixelRatio } from "react-native"
import { Image } from "expo-image"
import { optimizeImageUrl, DEFAULT_PLACEHOLDER } from "@/lib/images/optimize"

type Cell = { image?: { url: string }; url?: string }
type Props = { a?: Cell; b?: Cell; c?: Cell; onPressA?: () => void; onPressB?: () => void; onPressC?: () => void }

export function TrioGrid({ a, b, c, onPressA, onPressB, onPressC }: Props) {
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  return (
    <View className="w-full">
      <View className="flex-row">
        <Pressable onPress={onPressA} className="flex-1">
          {!!a?.image?.url && (
            <Image
              source={{
                uri: optimizeImageUrl(a.image.url, { width: 360, height: 180, format: "webp", dpr }) || a.image.url,
              }}
              className="h-[180px] w-full"
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
              placeholder={DEFAULT_PLACEHOLDER}
            />
          )}
        </Pressable>
        <Pressable onPress={onPressB} className="flex-1">
          {!!b?.image?.url && (
            <Image
              source={{
                uri: optimizeImageUrl(b.image.url, { width: 360, height: 180, format: "webp", dpr }) || b.image.url,
              }}
              className="h-[180px] w-full"
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
              placeholder={DEFAULT_PLACEHOLDER}
            />
          )}
        </Pressable>
        <Pressable onPress={onPressC} className="flex-1">
          {!!c?.image?.url && (
            <Image
              source={{
                uri: optimizeImageUrl(c.image.url, { width: 360, height: 180, format: "webp", dpr }) || c.image.url,
              }}
              className="h-[180px] w-full"
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
              placeholder={DEFAULT_PLACEHOLDER}
            />
          )}
        </Pressable>
      </View>
    </View>
  )
}
