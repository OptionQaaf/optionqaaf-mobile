import { Pressable, Text as RNText, useWindowDimensions } from "react-native"

type Props = {
  title?: string
  onPress?: () => void
  theme?: "light" | "dark" | string
}

export function HeadlinePromo({ title, onPress, theme = "light" }: Props) {
  const light = theme === "light"
  const { width } = useWindowDimensions()
  const size = Math.round(Math.min(68, Math.max(34, width * 0.12)))
  const line = Math.round(size * 1.08)
  return (
    <Pressable onPress={onPress} className={`rounded-3xl px-4 py-8 ${light ? "bg-white" : "bg-black"}`}>
      <RNText
        className={`font-extrabold ${light ? "text-black" : "text-white"}`}
        style={{ fontSize: size, lineHeight: line }}
      >
        {title}
      </RNText>
    </Pressable>
  )
}
