import { Text as RNText, type TextProps } from "react-native"
import { cn, cva, type VariantProps } from "../utils/cva"

const textStyles = cva("text-white", {
  variants: {
    tone: {
      default: "text-white",
      muted: "text-neutral-400",
      subtle: "text-neutral-300",
      danger: "text-red-400",
      success: "text-green-400",
    },
    align: { left: "text-left", center: "text-center", right: "text-right" },
  },
  defaultVariants: { tone: "default", align: "left" },
})

type TProps = TextProps & VariantProps<typeof textStyles> & { className?: string }

export function H1({ className, ...p }: any) {
  return <RNText {...p} className={cn("font-geist-bold text-primary text-[34px] leading-[40px]", className)} />
}
export function H2({ className, ...p }: any) {
  return <RNText {...p} className={cn("font-geist-bold text-primary text-[24px] leading-[32px]", className)} />
}
export function H3({ className, ...p }: any) {
  return <RNText {...p} className={cn("font-geist-bold text-primary text-[20px] leading-[28px]", className)} />
}
export function Text({ className, ...p }: any) {
  return <RNText {...p} className={cn("text-primary", className)} />
}
export function Muted({ className, ...p }: any) {
  return <RNText {...p} className={cn("text-muted", className)} />
}
