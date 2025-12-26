import { a11yButton } from "@/ui/a11y/a11y"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { cn, cva, type VariantProps } from "@/ui/utils/cva"
import { ReactNode } from "react"
import { ActivityIndicator, Text as RNText } from "react-native"

const buttonStyles = cva("flex-row items-center justify-center rounded-xl gap-2", {
  variants: {
    variant: {
      solid: "bg-brand",
      outline: "bg-surface border border-border",
      ghost: "bg-transparent",
      link: "bg-transparent",
      danger: "bg-danger/10 border border-danger/40",
    },
    size: {
      sm: "h-9 px-3",
      md: "h-11 px-4",
      lg: "h-12 px-6",
    },
    fullWidth: { true: "w-full", false: "" },
    disabled: { true: "", false: "" },
  },
  compoundVariants: [
    { variant: "link", className: "px-0 py-0 h-auto" },
    { variant: "danger", className: "text-danger" },
    { variant: "solid", disabled: true, className: "!bg-brand/40" },
    { variant: "outline", disabled: true, className: "!border-border/60 !bg-surface" },
    { variant: "ghost", disabled: true, className: "!bg-transparent" },
    { variant: "link", disabled: true, className: "!bg-transparent" },
    { variant: "danger", disabled: true, className: "!bg-danger/5 !border-danger/20" },
  ],
  defaultVariants: { variant: "solid", size: "md", fullWidth: false, disabled: false },
})

const labelStyles = cva("font-geist-bold", {
  variants: {
    variant: {
      solid: "text-white",
      outline: "text-primary",
      ghost: "text-primary",
      link: "text-primary underline",
      danger: "text-danger",
    },
    size: {
      sm: "text-[14px]",
      md: "text-[16px]",
      lg: "text-[17px]",
    },
    disabled: { true: "", false: "" },
  },
  compoundVariants: [
    { variant: "solid", disabled: true, className: "text-white/70" },
    { variant: "outline", disabled: true, className: "text-primary/50" },
    { variant: "ghost", disabled: true, className: "text-primary/50" },
    { variant: "link", disabled: true, className: "text-primary/50 underline" },
    { variant: "danger", disabled: true, className: "text-danger/60" },
  ],
  defaultVariants: { variant: "solid", size: "md", disabled: false },
})

type ButtonBaseProps = {
  children?: ReactNode
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  isLoading?: boolean
  fullWidth?: boolean
  className?: string
  onPress?: () => void
  accessibilityLabel?: string
  disabled?: boolean
  textClassName?: string
}

type ButtonProps = ButtonBaseProps & VariantProps<typeof buttonStyles> & VariantProps<typeof labelStyles>

export function Button({
  variant,
  size,
  fullWidth,
  disabled,
  isLoading,
  leftIcon,
  rightIcon,
  className,
  children,
  onPress,
  accessibilityLabel,
  textClassName,
}: ButtonProps) {
  const isDisabled = !!disabled || !!isLoading
  const spinnerColor = variant === "danger" ? "#DC2626" : !variant || variant === "solid" ? "#FFFFFF" : "#0B0B0B"

  return (
    <PressableOverlay
      haptic="light"
      {...a11yButton(typeof children === "string" ? children : undefined, isDisabled)}
      disabled={isDisabled}
      onPress={onPress}
      className={cn(buttonStyles({ variant, size, fullWidth, disabled: isDisabled }), className)}
    >
      <>
        {/* Left icon or spinner */}
        {isLoading ? <ActivityIndicator size="small" color={spinnerColor} /> : (leftIcon ?? null)}

        {/* Label */}
        {typeof children === "string" ? (
          <RNText
            accessibilityLabel={accessibilityLabel}
            className={cn(textClassName, labelStyles({ variant, size, disabled: isDisabled }))}
          >
            {children}
          </RNText>
        ) : (
          children
        )}

        {/* Right icon spacer (keeps alignment when only left spinner shows) */}
        {rightIcon ?? null}
      </>
    </PressableOverlay>
  )
}
