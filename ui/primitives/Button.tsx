import { a11yButton } from "@/ui/a11y/a11y"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { cn, cva, type VariantProps } from "@/ui/utils/cva"
import { ReactNode } from "react"
import { ActivityIndicator, Text as RNText } from "react-native"

const buttonStyles = cva("flex-row items-center justify-center rounded-xl gap-2", {
  variants: {
    variant: {
      solid: "bg-brand",
      outline: "bg-surface border border-border", // was transparent
      ghost: "bg-transparent",
      link: "bg-transparent",
    },
    size: {
      sm: "h-9 px-3",
      md: "h-11 px-4",
      lg: "h-12 px-6",
    },
    fullWidth: { true: "w-full", false: "" },
    disabled: { true: "opacity-50", false: "" },
  },
  compoundVariants: [{ variant: "link", className: "px-0 py-0 h-auto" }],
  defaultVariants: { variant: "solid", size: "md", fullWidth: false, disabled: false },
})

const labelStyles = cva("font-geist-medium", {
  variants: {
    variant: {
      solid: "text-white",
      outline: "text-primary",
      ghost: "text-primary",
      link: "text-primary underline",
    },
    size: {
      sm: "text-[14px]",
      md: "text-[16px]",
      lg: "text-[17px]",
    },
  },
  defaultVariants: { variant: "solid", size: "md" },
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
}: ButtonProps) {
  const spinnerColor = !variant || variant === "solid" ? "#FFFFFF" : "#0B0B0B"

  return (
    <PressableOverlay
      {...a11yButton(typeof children === "string" ? children : undefined, disabled || isLoading)}
      disabled={disabled || isLoading}
      onPress={onPress}
      className={cn(buttonStyles({ variant, size, fullWidth, disabled }), className)}
    >
      <>
        {/* Left icon or spinner */}
        {isLoading ? <ActivityIndicator size="small" color={spinnerColor} /> : (leftIcon ?? null)}

        {/* Label */}
        {typeof children === "string" ? (
          <RNText accessibilityLabel={accessibilityLabel} className={labelStyles({ variant, size })}>
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
