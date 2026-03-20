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
    <View
      className={"flex-row items-center rounded-sm border border-border overflow-hidden " + (className ?? "")}
    >
      <PressableOverlay
        onPress={dec}
        disabled={disabled}
        className="w-8 h-8 items-center justify-center"
      >
        <Minus size={13} color={disabled ? "#d1d5db" : "#6b7280"} />
      </PressableOverlay>

      <Text
        className="text-primary font-geist-medium text-[13px] text-center"
        style={{ minWidth: 20, fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>

      <PressableOverlay
        onPress={inc}
        disabled={disabled}
        className="w-8 h-8 items-center justify-center"
      >
        <Plus size={13} color={disabled ? "#d1d5db" : "#6b7280"} />
      </PressableOverlay>
    </View>
  )
}
