import { useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, Text as RNText, View, useWindowDimensions, type LayoutChangeEvent } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import type { SectionSize } from "@/lib/shopify/services/home"
import { sizeScale } from "./sectionSize"

type Props = {
  text?: string
  speed?: number // px/s; negative reverses direction
  theme?: "light" | "dark" | (string & {})
  height?: number
  onPress?: () => void
  size?: SectionSize
}

const NBSP = "\u00A0" // non-breaking space
const DEFAULT_SPEED = 30

export function RibbonMarquee({
  text = "OPTIONQAAF",
  speed = DEFAULT_SPEED,
  theme = "light",
  height = 32,
  onPress,
  size,
}: Props) {
  const { width: screenW } = useWindowDimensions()
  const colorBg = theme === "dark" ? "#0B0B0B" : "#8E1A26"
  const colorFg = theme === "dark" ? "#FFFFFF" : "#FFEDED"
  const scale = sizeScale(size)
  const ribbonHeight = Math.max(20, Math.round(height * scale))

  // one logical "unit" with bullet + NBSP spacing (doesn't collapse)
  const normalized = useMemo(() => (text?.trim() ? text.trim() : "OPTIONQAAF"), [text])
  const unit = useMemo(() => `${normalized}${NBSP}${NBSP}\u2022${NBSP}${NBSP}`, [normalized])

  // how many units to render inside a segment
  const [units, setUnits] = useState(6)
  const [segmentW, setSegmentW] = useState(0)

  const tx = useSharedValue(0)

  const { duration, startValue, endValue } = useMemo(() => {
    const numericSpeed =
      typeof speed === "number" && Number.isFinite(speed) ? speed : DEFAULT_SPEED
    const magnitude = Math.abs(numericSpeed)
    const direction = magnitude === 0 ? 1 : Math.sign(numericSpeed) || 1
    const effectivePxps =
      magnitude === 0
        ? DEFAULT_SPEED
        : magnitude < 1
          ? magnitude * DEFAULT_SPEED
          : magnitude
    const travel = segmentW
    const ms =
      travel > 0 && Number.isFinite(effectivePxps) && effectivePxps > 0
        ? (travel / effectivePxps) * 1000
        : 0

    return {
      duration: ms,
      startValue: direction >= 0 ? 0 : -travel,
      endValue: direction >= 0 ? -travel : 0,
    }
  }, [segmentW, speed])

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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }))

  useEffect(() => {
    cancelAnimation(tx)

    if (!segmentW || !Number.isFinite(duration) || duration <= 0) {
      tx.value = startValue
      return
    }

    tx.value = startValue
    tx.value = withRepeat(
      withTiming(endValue, {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false,
    )

    return () => {
      cancelAnimation(tx)
    }
  }, [duration, endValue, segmentW, startValue, tx])

  const textStyle = {
    color: colorFg,
    letterSpacing: 1.5 as number,
    includeFontPadding: false,
    textAlignVertical: "center" as const,
    lineHeight: ribbonHeight,
    fontSize: 10 * scale,
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
      <View style={{ height: ribbonHeight, overflow: "hidden" }}>
        <Animated.View style={[{ flexDirection: "row" }, animatedStyle]}>
          <SegmentRow onLayout={shouldMeasure ? (e) => handleMeasure(e.nativeEvent.layout.width) : undefined} />
          {/* duplicate back-to-back, so the screen is always filled */}
          <SegmentRow />
        </Animated.View>
      </View>
    </Pressable>
  )
}
