import { Pressable, Text as RNText, View } from "react-native"

type Props = { title?: string; subtitle?: string; theme?: string; onPress?: () => void }

export function EditorialQuote({ title, subtitle, theme = "light", onPress }: Props) {
  const light = theme === "light"
  return (
    <Pressable onPress={onPress}>
      <View className={light ? "bg-white" : "bg-black"}>
        {subtitle ? (
          <RNText className={`px-5 pt-8 text-xl ${light ? "text-black/70" : "text-white/70"}`}>{subtitle}</RNText>
        ) : null}
        <RNText
          className={`px-4 pb-8 text-[40px] leading-[44px] font-extrabold ${light ? "text-black" : "text-white"}`}
        >
          {title}
        </RNText>
      </View>
    </Pressable>
  )
}
