import { cn } from "@/ui/utils/cva"
import { ReactNode } from "react"
import { View, ViewProps } from "react-native"

type Props = ViewProps & {
  children: ReactNode
  gap?: string
  center?: boolean
  between?: boolean
}
export function Row({ children, className, gap = "gap-3", center, between, ...p }: Props) {
  return (
    <View
      {...p}
      className={cn("flex-row items-center", gap, center && "justify-center", between && "justify-between", className)}
    >
      {children}
    </View>
  )
}
