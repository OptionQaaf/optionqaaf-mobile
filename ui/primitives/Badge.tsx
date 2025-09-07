import { cn, cva, type VariantProps } from "@/ui/utils/cva"
import { Text as RNText, View } from "react-native"

const badge = cva("px-2.5 h-7 rounded-full items-center justify-center border", {
  variants: {
    variant: {
      neutral: "bg-surface border-border",
      brand: "bg-brand border-brand",
      outline: "bg-transparent border-border",
      success: "bg-success/10 border-success/30",
      danger: "bg-danger/10 border-danger/30",
    },
  },
  defaultVariants: { variant: "neutral" },
})

const label = cva("", {
  variants: {
    variant: {
      neutral: "text-primary",
      brand: "text-white",
      outline: "text-primary",
      success: "text-success",
      danger: "text-danger",
    },
  },
})

type Props = { children: string; className?: string } & VariantProps<typeof badge>
export function Badge({ children, variant, className }: Props) {
  return (
    <View className={cn(badge({ variant }), className)}>
      <RNText className={label({ variant })}>{children}</RNText>
    </View>
  )
}
