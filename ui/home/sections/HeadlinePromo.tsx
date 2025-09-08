import { Pressable, Text as RNText } from "react-native"

type Props = {
  title?: string
  subtitle?: string
  onPress?: () => void
  theme?: "light" | "dark" | string
}

export function HeadlinePromo({ title, subtitle, onPress, theme = "light" }: Props) {
  const light = theme === "light"
  return (
    <Pressable onPress={onPress} className={`rounded-3xl px-4 py-8 ${light ? "bg-white" : "bg-black"}`}>
      {subtitle ? (
        <RNText className={`mb-2 text-xl ${light ? "text-black/70" : "text-white/70"}`}>{subtitle}</RNText>
      ) : null}
      <RNText className={`text-6xl leading-[64px] font-extrabold ${light ? "text-black" : "text-white"}`}>
        {title}
      </RNText>
    </Pressable>
  )
}
