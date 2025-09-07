import { hitTarget } from "@/ui/a11y/a11y"
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
}

export function PressableOverlay({ children, className, style, disabled, onPress, hitSlop: hs }: Props) {
  const { style: aStyle, onPressIn, onPressOut } = usePressAnim()
  return (
    <Pressable
      disabled={!!disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      hitSlop={hs ?? hitTarget}
    >
      <Animated.View style={aStyle} className={cn(disabled && "opacity-50", className)}>
        {children}
      </Animated.View>
    </Pressable>
  )
}
