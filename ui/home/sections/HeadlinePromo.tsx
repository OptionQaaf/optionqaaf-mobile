import { Pressable, Text as RNText, useWindowDimensions } from "react-native"
import type { SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"

type Props = {
  title?: string
  onPress?: () => void
  theme?: "light" | "dark" | string
  size?: SectionSize
}

export function HeadlinePromo({ title, onPress, theme = "light", size }: Props) {
  const light = theme === "light"
  const { width } = useWindowDimensions()
  const scale = sizeScale(size)
  const fontSize = Math.round(Math.min(68, Math.max(34, width * 0.12 * scale)))
  const line = Math.round(fontSize * 1.08)
  const paddingV = Math.round(24 * scale)
  const paddingH = Math.round(16 * scale)
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-3xl ${light ? "bg-white" : "bg-black"}`}
      style={{ paddingVertical: paddingV, paddingHorizontal: paddingH }}
    >
      <RNText
        className={`font-extrabold ${light ? "text-black" : "text-white"}`}
        style={{ fontSize: fontSize, lineHeight: line }}
      >
        {title}
      </RNText>
    </Pressable>
  )
}
