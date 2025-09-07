import { cn } from "@/ui/utils/cva"
import { Text, View, ViewProps } from "react-native"

export function Story({ title, children, className }: ViewProps & { title: string; className?: string }) {
  return (
    <View className={cn("bg-surface border border-border rounded-xl p-4", className)}>
      <Text className="text-primary font-geist-semibold mb-3">{title}</Text>
      {children}
    </View>
  )
}

export function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <View className="flex-row items-center gap-3 mb-2">
      <View className={cn("w-8 h-8 rounded-md border border-border", className)} />
      <Text className="text-secondary">{name}</Text>
    </View>
  )
}
