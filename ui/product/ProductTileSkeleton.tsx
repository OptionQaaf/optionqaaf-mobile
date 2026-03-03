import { Skeleton } from "@/ui/feedback/Skeleton"
import { cn } from "@/ui/utils/cva"
import { View } from "react-native"

type Props = {
  width?: number
  padding?: "sm" | "md" | "lg"
  imageRatio?: number
  variant?: "card" | "plain"
  className?: string
}

export function ProductTileSkeleton({ width, padding = "md", imageRatio = 3 / 4, variant = "card", className }: Props) {
  const pad = padding === "lg" ? "p-4" : padding === "sm" ? "p-2.5" : "p-3"
  const cardChrome = variant === "card" ? "bg-surface" : ""

  return (
    <View className={cn("rounded-sm overflow-hidden w-full", className)} style={width ? { width } : undefined}>
      <View className={cn(cardChrome, "overflow-hidden")}>
        <View style={{ aspectRatio: imageRatio, backgroundColor: "#F5F5F7" }}>
          <Skeleton className="w-full h-full" style={{ flex: 1 }} />
        </View>

        <View className={cn(pad, "gap-2")}>
          <Skeleton className="h-3 rounded-sm w-2/5" />
          <View className="gap-1.5">
            <Skeleton className="h-3.5 rounded-sm w-4/5" />
            <Skeleton className="h-3.5 rounded-sm w-3/5" />
          </View>
        </View>
      </View>
    </View>
  )
}
