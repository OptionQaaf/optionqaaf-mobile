import { cn, cva, type VariantProps } from "@/ui/utils/cva"
import { View, ViewProps } from "react-native"

const cardInner = cva("bg-surface border border-border rounded-xl", {
  variants: { padding: { none: "", sm: "p-3", md: "p-4", lg: "p-6" }, clip: { true: "overflow-hidden", false: "" } },
  defaultVariants: { padding: "md", clip: false },
})

type Props = ViewProps & VariantProps<typeof cardInner> & { elevated?: boolean; className?: string }

export function Card({ elevated, padding, clip, className, children, ...p }: Props) {
  return (
    <View className={cn(elevated && "shadow-md rounded-xl")}>
      <View {...p} className={cn(cardInner({ padding, clip }), className)}>
        {children}
      </View>
    </View>
  )
}
