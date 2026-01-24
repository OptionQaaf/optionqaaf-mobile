import { useEffect } from "react"
import { cn } from "@/ui/utils/cva"
import { ViewProps } from "react-native"
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated"

type Props = ViewProps & { className?: string }
export function Skeleton({ className, style, ...p }: Props) {
  const t = useSharedValue(0.6)
  const a = useAnimatedStyle(() => ({ opacity: t.value }))

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)
    return () => {
      cancelAnimation(t)
    }
  }, [t])

  return <Animated.View {...p} style={[a, style]} className={cn("bg-elev rounded-md", className)} />
}
