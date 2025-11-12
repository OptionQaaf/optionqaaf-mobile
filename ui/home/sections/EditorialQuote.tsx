import { Pressable, Text as RNText, View, useWindowDimensions } from "react-native"
import type { SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"

type Props = { title?: string; theme?: string; onPress?: () => void; size?: SectionSize }

export function EditorialQuote({ title, theme = "light", onPress, size }: Props) {
  const light = theme === "light"
  const { width } = useWindowDimensions()
  const scale = sizeScale(size)
  const fontSize = Math.round(Math.min(72, Math.max(36, width * 0.12 * scale)))
  const line = Math.round(fontSize * 1.05)
  return (
    <Pressable onPress={onPress}>
      <View className={light ? "bg-white" : "bg-black"}>
        <RNText
          className={`font-extrabold ${light ? "text-black" : "text-white"}`}
          style={{ fontSize, lineHeight: line, padding: 16 * scale }}
        >
          {title}
        </RNText>
      </View>
    </Pressable>
  )
}
