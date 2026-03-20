import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Minus, Plus } from "lucide-react-native"
import { Text, View } from "react-native"

type Props = {
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
  disabled?: boolean
  className?: string
}

export function QuantityStepper({ value, min = 1, max = 99, onChange, disabled, className }: Props) {
  const dec = () => !disabled && onChange(Math.max(min, value - 1))
  const inc = () => !disabled && onChange(Math.min(max, value + 1))

  return (
    <View className={"flex-row items-center gap-3 " + (className ?? "")}>
      <PressableOverlay
        onPress={dec}
        disabled={disabled}
        className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
      >
        <Minus size={16} color={disabled ? "#d1d5db" : undefined} />
      </PressableOverlay>

      {/* fixed width + centered + tabular-nums */}
      <Text
        className="text-primary font-geist-medium text-[16px] text-center"
        style={{ minWidth: 28, fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>

      <PressableOverlay
        onPress={inc}
        disabled={disabled}
        className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
      >
        <Plus size={16} color={disabled ? "#d1d5db" : undefined} />
      </PressableOverlay>
    </View>
  )
}
