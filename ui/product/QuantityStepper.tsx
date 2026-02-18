import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Minus, Plus } from "lucide-react-native"
import { Text, View } from "react-native"

type Props = {
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
  className?: string
  size?: "sm" | "md"
}

export function QuantityStepper({ value, min = 1, max = 99, onChange, className, size = "md" }: Props) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  const compact = size === "sm"
  const buttonSize = compact ? 32 : 40
  const iconSize = compact ? 14 : 16
  const valueTextSize = compact ? 14 : 16
  const valueMinWidth = compact ? 22 : 28

  return (
    <View className={`flex-row items-center ${compact ? "gap-2" : "gap-3"} ${className ?? ""}`}>
      <PressableOverlay
        onPress={dec}
        className="rounded-full bg-surface border border-border items-center justify-center"
        style={{ width: buttonSize, height: buttonSize }}
      >
        <Minus size={iconSize} />
      </PressableOverlay>

      {/* fixed width + centered + tabular-nums */}
      <Text
        className="text-primary font-geist-medium text-center"
        style={{ minWidth: valueMinWidth, fontVariant: ["tabular-nums"], fontSize: valueTextSize }}
      >
        {value}
      </Text>

      <PressableOverlay
        onPress={inc}
        className="rounded-full bg-surface border border-border items-center justify-center"
        style={{ width: buttonSize, height: buttonSize }}
      >
        <Plus size={iconSize} />
      </PressableOverlay>
    </View>
  )
}
