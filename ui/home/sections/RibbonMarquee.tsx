import { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, Pressable, Text as RNText, View, useWindowDimensions } from "react-native"

type Props = {
  text?: string
  speed?: number // px/s; negative reverses direction
  theme?: "light" | "dark" | (string & {})
  height?: number
  onPress?: () => void
}

const NBSP = "\u00A0" // non-breaking space

export function RibbonMarquee({ text = "OPTIONQAAF", speed = 30, theme = "light", height = 32, onPress }: Props) {
  const { width: screenW } = useWindowDimensions()
  const colorBg = theme === "dark" ? "#0B0B0B" : "#8E1A26"
  const colorFg = theme === "dark" ? "#FFFFFF" : "#FFEDED"

  // one logical "unit" with bullet + NBSP spacing (doesn't collapse)
  const unit = useMemo(() => `${text}${NBSP}${NBSP}\u2022${NBSP}${NBSP}`, [text])

  // how many units to render inside a segment
  const [units, setUnits] = useState(6)
  const [segmentW, setSegmentW] = useState(0)

  const tx = useRef(new Animated.Value(0)).current
  const loopRef = useRef<Animated.CompositeAnimation | null>(null)

  // measure actual row width off-screen; grow until it exceeds the screen
  const handleMeasure = (w: number) => {
    if (!w) return
    if (w < screenW + 24)
      setUnits((u) => u + 2) // add more content, re-measure
    else setSegmentW(w)
  }

  useEffect(() => () => loopRef.current?.stop(), [])

  useEffect(() => {
    loopRef.current?.stop()
    if (!segmentW || !speed) return

    const dir = Math.sign(speed)
    const pxps = Math.abs(speed)
    const duration = (segmentW / pxps) * 1000

    tx.setValue(dir >= 0 ? 0 : -segmentW)
    loopRef.current = Animated.loop(
      Animated.timing(tx, {
        toValue: dir >= 0 ? -segmentW : 0,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      // @ts-ignore older RN types
      { resetBeforeIteration: true },
    )
    loopRef.current.start()
  }, [segmentW, speed])

  const textStyle = {
    color: colorFg,
    letterSpacing: 1.5 as number,
    includeFontPadding: false,
    textAlignVertical: "center" as const,
    lineHeight: height,
    fontSize: 10,
    fontWeight: "700" as const,
  }

  const SegmentRow = ({ measure }: { measure?: boolean }) => (
    <View
      style={[{ flexDirection: "row" }, measure && { position: "absolute", opacity: 0, left: -10000 }]}
      onLayout={measure ? (e) => handleMeasure(e.nativeEvent.layout.width) : undefined}
    >
      {Array.from({ length: units }).map((_, i) => (
        <RNText key={i} numberOfLines={1} ellipsizeMode="clip" style={textStyle as any}>
          {unit}
        </RNText>
      ))}
    </View>
  )

  return (
    <Pressable onPress={onPress} style={{ backgroundColor: colorBg }}>
      {/* off-screen measurer of the exact segment */}
      <SegmentRow measure />

      {/* ribbon */}
      <View style={{ height, overflow: "hidden" }}>
        <Animated.View style={{ flexDirection: "row", transform: [{ translateX: tx }] }}>
          <SegmentRow />
          {/* duplicate back-to-back, so the screen is always filled */}
          <SegmentRow />
        </Animated.View>
      </View>
    </Pressable>
  )
}
