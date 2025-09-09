import { Pressable, Text as RNText, View, useWindowDimensions } from "react-native"

type Props = { title?: string; theme?: string; onPress?: () => void }

export function EditorialQuote({ title, theme = "light", onPress }: Props) {
  const light = theme === "light"
  const { width } = useWindowDimensions()
  const size = Math.round(Math.min(72, Math.max(36, width * 0.12)))
  const line = Math.round(size * 1.05)
  return (
    <Pressable onPress={onPress}>
      <View className={light ? "bg-white" : "bg-black"}>
        <RNText
          className={`p-4 font-extrabold ${light ? "text-black" : "text-white"}`}
          style={{ fontSize: size, lineHeight: line }}
        >
          {title}
        </RNText>
      </View>
    </Pressable>
  )
}
