import { cn } from "@/ui/utils/cva"
import { ReactNode } from "react"
import { View, ViewProps } from "react-native"

type Props = ViewProps & {
  children: ReactNode
  gap?: string // e.g. "gap-4"
  center?: boolean
}
export function Stack({ children, className, gap = "gap-4", center, ...p }: Props) {
  return (
    <View {...p} className={cn("flex-col", gap, center && "items-center", className)}>
      {children}
    </View>
  )
}
