import { useCallback, useEffect, useMemo, useState } from "react"
import type { LayoutChangeEvent, NativeSyntheticEvent, TextLayoutEventData } from "react-native"
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
  const padding = 4
  const baseFontSize = useMemo(() => Math.round(Math.min(68, Math.max(34, width * 0.12 * scale))), [scale, width])
  const [fontSize, setFontSize] = useState(baseFontSize)
  const [containerWidth, setContainerWidth] = useState<number | undefined>()

  useEffect(() => {
    setFontSize(baseFontSize)
  }, [baseFontSize])

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width)
  }, [])

  const onTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (!containerWidth) return

      const availableWidth = Math.max(containerWidth - padding * 2, 0)
      const lines = event.nativeEvent.lines ?? []
      if (!lines.length) return

      const widestLine = lines.reduce((max, line) => Math.max(max, line.width ?? 0), 0)
      if (lines.length > 1 || widestLine > availableWidth) {
        const ratio = availableWidth / Math.max(widestLine, 1)
        const nextSize = Math.max(10, Math.min(fontSize - 1, Math.floor(fontSize * ratio)))
        if (nextSize < fontSize) {
          setFontSize(nextSize)
        }
      }
    },
    [containerWidth, fontSize, padding],
  )

  const line = Math.round(fontSize * 1.08)
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-3xl ${light ? "bg-white" : "bg-black"}`}
      style={{ padding }}
      onLayout={onLayout}
    >
      <RNText
        className={`font-extrabold ${light ? "text-black" : "text-white"}`}
        style={{ fontSize: fontSize, lineHeight: line }}
        onTextLayout={onTextLayout}
      >
        {title}
      </RNText>
    </Pressable>
  )
}
