import { cn } from "@/ui/utils/cva"
import { Pressable, Text, View } from "react-native"

export function Segment({
  options,
  value,
  onChange,
  className,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <View className={cn("flex-row bg-surface rounded-full border border-border p-1", className)}>
      {options.map((opt) => {
        const on = opt === value
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            className={cn("px-3 h-8 rounded-full items-center justify-center", on ? "bg-brand" : "")}
          >
            <Text className={cn(on ? "text-white" : "text-primary")}>{opt}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} className="flex-row items-center gap-2">
      <View className={cn("w-10 h-6 rounded-full px-1 justify-center", value ? "bg-brand" : "bg-border")}>
        <View className={cn("w-4 h-4 rounded-full bg-white", value ? "self-end" : "self-start")} />
      </View>
      <Text className="text-primary">{label}</Text>
    </Pressable>
  )
}

export function NumberKnob({
  label,
  value,
  min = 0,
  max = 10,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Text className="text-secondary">{label}</Text>
      <Pressable
        onPress={() => onChange(Math.max(min, value - step))}
        className="w-7 h-7 rounded-full border border-border items-center justify-center"
      >
        <Text className="text-primary">-</Text>
      </Pressable>
      <Text className="text-primary w-6 text-center">{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + step))}
        className="w-7 h-7 rounded-full border border-border items-center justify-center"
      >
        <Text className="text-primary">+</Text>
      </Pressable>
    </View>
  )
}
