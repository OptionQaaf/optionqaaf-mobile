import { cn } from "@/ui/utils/cva"
import { ReactNode } from "react"
import { View, ViewProps } from "react-native"

type Props = ViewProps & { children: ReactNode; inset?: boolean }
export function Container({ children, className, inset = true, ...p }: Props) {
  return (
    <View {...p} className={cn("w-full self-center max-w-[1120px]", inset ? "px-6" : "", className)}>
      {children}
    </View>
  )
}
