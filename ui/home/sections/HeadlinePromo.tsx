import type { SectionSize } from "@/lib/shopify/services/home"
import { useMemo } from "react"
import { Pressable, Text as RNText, useWindowDimensions } from "react-native"
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
  const padding = 4
  const baseFontSize = useMemo(() => Math.round(Math.min(68, Math.max(34, width * 0.12 * scale))), [scale, width])
  const minimumFontScale = useMemo(() => Math.max(10 / baseFontSize, 0.25), [baseFontSize])

  const line = Math.round(baseFontSize * 1.08)
  return (
    <Pressable
      onPress={onPress}
      className={`w-full rounded-3xl ${light ? "bg-white" : "bg-black"}`}
      style={{ padding, width: "100%" }}
    >
      <RNText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={minimumFontScale}
        ellipsizeMode="clip"
        className={`font-extrabold uppercase ${light ? "text-black" : "text-white"}`}
        style={{ fontSize: baseFontSize, lineHeight: line, minWidth: 0, width: "100%", maxWidth: "100%", flexShrink: 1 }}
      >
        {title}
      </RNText>
    </Pressable>
  )
}
