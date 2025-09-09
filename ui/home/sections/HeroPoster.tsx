import { ImageBackground, Pressable, Text as RNText, View, useWindowDimensions } from "react-native"

type Props = {
  title?: string
  image?: { url: string }
  onPress?: () => void
  theme?: "light" | "dark" | string
}

export function HeroPoster({ title, image, onPress, theme = "light" }: Props) {
  const light = theme === "light"
  const { width } = useWindowDimensions()
  const titleSize = Math.round(Math.min(88, Math.max(40, width * 0.16)))
  const line = Math.round(titleSize * 1.05)
  return (
    <Pressable onPress={onPress} className="overflow-hidden">
      <ImageBackground source={{ uri: image?.url }} resizeMode="cover" className="h-[360px] w-full">
        <View className="flex-1 p-4 justify-end">
          {title ? (
            <RNText
              className={`font-extrabold ${light ? "text-white" : "text-black"}`}
              style={{ fontSize: titleSize, lineHeight: line, maxWidth: "88%" }}
              numberOfLines={3}
            >
              {title}
            </RNText>
          ) : null}
        </View>
      </ImageBackground>
    </Pressable>
  )
}
