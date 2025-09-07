import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Minus, Plus } from "lucide-react-native"
import { Text, View } from "react-native"

type Props = {
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
  className?: string
}

export function QuantityStepper({ value, min = 1, max = 99, onChange, className }: Props) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))

  return (
    <View className={"flex-row items-center gap-3 " + (className ?? "")}>
      <PressableOverlay
        onPress={dec}
        className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
      >
        <Minus size={16} />
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
        className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
      >
        <Plus size={16} />
      </PressableOverlay>
    </View>
  )
}
