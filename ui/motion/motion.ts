import { useEffect } from "react"
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

export const MOTION = {
  dur: { xs: 120, sm: 140, md: 220, lg: 320 },
  spring: () => LinearTransition.springify().damping(18).stiffness(180),
  linear: (ms = 160) => LinearTransition.duration(ms),
  // entering/exiting presets
  enter: {
    fade: FadeIn.duration(160),
    fadeDown: FadeInDown.duration(160),
    fadeUp: FadeInUp.duration(160),
  },
  exit: {
    fade: FadeOut.duration(140),
    fadeDown: FadeOutDown.duration(140),
    fadeUp: FadeOutUp.duration(140),
  },
}

// crossfade hook (returns animated style you can spread on two siblings)
export function useCrossfade(show: boolean, duration = MOTION.dur.sm) {
  const a = useSharedValue(show ? 1 : 0)
  useEffect(() => {
    a.value = withTiming(show ? 1 : 0, { duration })
  }, [show, duration])
  return useAnimatedStyle(() => ({ opacity: a.value }))
}

// press animation hook (scale + opacity)
export function usePressAnim({ scale = 0.98, dim = 0.9, duration = MOTION.dur.xs } = {}) {
  const v = useSharedValue(0)
  const onPressIn = () => (v.value = withTiming(1, { duration }))
  const onPressOut = () => (v.value = withTiming(0, { duration }))
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scale) * v.value }],
    opacity: 1 - (1 - dim) * v.value,
  }))
  return { style, onPressIn, onPressOut }
}

export { Animated } // convenience re-export
