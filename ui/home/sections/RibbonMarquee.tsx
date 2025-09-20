import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Pressable,
  Text as RNText,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native"

type Props = {
  text?: string
  speed?: number // px/s; negative reverses direction
  theme?: "light" | "dark" | (string & {})
  height?: number
  onPress?: () => void
}

const NBSP = "\u00A0" // non-breaking space
const DEFAULT_SPEED = 30

export function RibbonMarquee({ text = "OPTIONQAAF", speed = DEFAULT_SPEED, theme = "light", height = 32, onPress }: Props) {
  const { width: screenW } = useWindowDimensions()
  const colorBg = theme === "dark" ? "#0B0B0B" : "#8E1A26"
  const colorFg = theme === "dark" ? "#FFFFFF" : "#FFEDED"

  // one logical "unit" with bullet + NBSP spacing (doesn't collapse)
  const normalized = useMemo(() => (text?.trim() ? text.trim() : "OPTIONQAAF"), [text])
  const unit = useMemo(() => `${normalized}${NBSP}${NBSP}\u2022${NBSP}${NBSP}`, [normalized])

  // how many units to render inside a segment
  const [units, setUnits] = useState(6)
  const [segmentW, setSegmentW] = useState(0)

  const tx = useRef(new Animated.Value(0)).current
  const loopRef = useRef<Animated.CompositeAnimation | null>(null)

  // measure the rendered row and keep adding units until it comfortably exceeds the screen width
  const handleMeasure = useCallback(
    (w: number) => {
      if (!w) return
      if (w < screenW + 24 && units < 48) {
        setUnits((u) => u + 2)
        return
      }
      setSegmentW((prev) => (Math.abs(prev - w) < 1 ? prev : w))
    },
    [screenW, units],
  )

  useEffect(() => {
    setUnits(6)
    setSegmentW(0)
  }, [unit, screenW])

  useEffect(() => () => loopRef.current?.stop(), [])

  useEffect(() => {
    loopRef.current?.stop()
    tx.stopAnimation()
    if (!segmentW) {
      loopRef.current = null
      return
    }

    const magnitude = Math.abs(speed)
    const effectivePxps =
      magnitude === 0 ? DEFAULT_SPEED : magnitude < 1 ? magnitude * DEFAULT_SPEED : magnitude
    const dir = magnitude === 0 ? 1 : Math.sign(speed)
    const duration = (segmentW / effectivePxps) * 1000

    tx.setValue(dir >= 0 ? 0 : -segmentW)
    loopRef.current = Animated.loop(
      Animated.timing(tx, {
        toValue: dir >= 0 ? -segmentW : 0,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
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

  const SegmentRow = ({ onLayout }: { onLayout?: (event: LayoutChangeEvent) => void }) => (
    <View style={{ flexDirection: "row" }} onLayout={onLayout}>
      {Array.from({ length: units }).map((_, i) => (
        <RNText key={i} numberOfLines={1} ellipsizeMode="clip" style={textStyle as any}>
          {unit}
        </RNText>
      ))}
    </View>
  )

  const shouldMeasure = segmentW === 0

  return (
    <Pressable onPress={onPress} style={{ backgroundColor: colorBg }}>
      {/* ribbon */}
      <View style={{ height, overflow: "hidden" }}>
        <Animated.View style={{ flexDirection: "row", transform: [{ translateX: tx }] }}>
          <SegmentRow onLayout={shouldMeasure ? (e) => handleMeasure(e.nativeEvent.layout.width) : undefined} />
          {/* duplicate back-to-back, so the screen is always filled */}
          <SegmentRow />
        </Animated.View>
      </View>
    </Pressable>
  )
}
