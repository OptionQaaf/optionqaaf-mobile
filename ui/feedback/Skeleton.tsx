import { cn } from "@/ui/utils/cva"
import { ViewProps } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated"

type Props = ViewProps & { className?: string }
export function Skeleton({ className, style, ...p }: Props) {
  const t = useSharedValue(0.6)
  const a = useAnimatedStyle(() => ({ opacity: t.value }))
  t.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)
  return <Animated.View {...p} style={[a, style]} className={cn("bg-elev rounded-md", className)} />
}
