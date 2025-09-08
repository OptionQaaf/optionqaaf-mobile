import { hitTarget } from "@/ui/a11y/a11y"
import { hapticOnce, haptics } from "@/ui/feedback/useHaptics"
import { Animated, usePressAnim } from "@/ui/motion/motion"
import { cn } from "@/ui/utils/cva"
import { ReactNode } from "react"
import { Pressable, ViewStyle } from "react-native"

type Props = {
  children: ReactNode
  className?: string
  style?: ViewStyle | ViewStyle[]
  disabled?: boolean
  onPress?: () => void
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number }
  haptic?: false | "light" | "medium" | "heavy"
  pressableClassName?: string
}

export function PressableOverlay({
  children,
  className,
  pressableClassName,
  style,
  disabled,
  onPress,
  hitSlop: hs,
  haptic = "light",
}: Props) {
  const { style: aStyle, onPressIn, onPressOut } = usePressAnim()

  const handlePressIn = () => {
    onPressIn()
    if (haptic && !disabled) {
      const map = { light: haptics.impact.light, medium: haptics.impact.medium, heavy: haptics.impact.heavy }
      hapticOnce(map[haptic])
    }
  }

  return (
    <Pressable
      disabled={!!disabled}
      onPressIn={handlePressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      hitSlop={hs ?? hitTarget}
      className={pressableClassName}
    >
      <Animated.View style={aStyle} className={cn(disabled && "opacity-50", className)}>
        {children}
      </Animated.View>
    </Pressable>
  )
}
