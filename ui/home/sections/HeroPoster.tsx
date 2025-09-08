import { ImageBackground, Pressable, Text as RNText, View } from "react-native"

type Props = {
  title?: string
  subtitle?: string
  image?: { url: string }
  onPress?: () => void
  theme?: "light" | "dark" | string
}

export function HeroPoster({ title, subtitle, image, onPress, theme = "light" }: Props) {
  const light = theme === "light"
  return (
    <Pressable onPress={onPress} className="overflow-hidden">
      <ImageBackground source={{ uri: image?.url }} resizeMode="cover" className="h-[360px] w-full">
        <View className="flex-1 px-4 py-2 justify-end">
          {subtitle ? (
            <RNText className={`mb-1 text-lg ${light ? "text-white/80" : "text-black/70"}`}>{subtitle}</RNText>
          ) : null}
          {title ? (
            <RNText className={`text-9xl font-extrabold ${light ? "text-white" : "text-black"}`}>{title}</RNText>
          ) : null}
        </View>
      </ImageBackground>
    </Pressable>
  )
}
