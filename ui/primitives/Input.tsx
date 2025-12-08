import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Muted, Text } from "@/ui/primitives/Typography"
import { cn, cva, type VariantProps } from "@/ui/utils/cva"
import { Eye, EyeOff } from "lucide-react-native"
import { useState } from "react"
import { TextInput, TextInputProps, View } from "react-native"

const wrapper = cva("w-full rounded-xl bg-surface border flex-row items-center px-3", {
  variants: {
    size: { sm: "h-10", md: "h-12", lg: "h-14" },
    state: {
      default: "border-border",
      focus: "border-brand",
      error: "border-danger",
      disabled: "opacity-50",
    },
  },
  defaultVariants: { size: "md", state: "default" },
})

type Props = TextInputProps &
  VariantProps<typeof wrapper> & {
    label?: string
    helper?: string
    error?: string
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    secureToggle?: boolean
    className?: string
  }

export function Input({
  label,
  helper,
  error,
  leftIcon,
  rightIcon,
  secureTextEntry,
  secureToggle,
  editable = true,
  size,
  className,
  onFocus,
  onBlur,
  multiline,
  textAlignVertical,
  style,
  ...p
}: Props) {
  const [focused, setFocused] = useState(false)
  const [hide, setHide] = useState(!!secureTextEntry)
  const isMultiline = !!multiline

  const state: NonNullable<VariantProps<typeof wrapper>["state"]> = !editable
    ? "disabled"
    : error
      ? "error"
      : focused
        ? "focus"
        : "default"

  return (
    <View className="w-full flex-1">
      {!!label && <Text className="mb-2">{label}</Text>}

      <View
        className={cn(
          wrapper({ size, state }),
          isMultiline ? "items-start h-auto min-h-[140px] py-3" : "",
          className,
        )}
      >
        {!!leftIcon && <View className="mr-2">{leftIcon}</View>}

        <TextInput
          {...p}
          multiline={multiline}
          className="flex-1 text-primary"
          editable={editable}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          secureTextEntry={hide}
          textAlignVertical={textAlignVertical ?? (isMultiline ? "top" : undefined)}
          style={[isMultiline ? { paddingTop: 0, paddingBottom: 0 } : null, style]}
          placeholderTextColor="#6B7280"
        />

        {secureToggle ? (
          <PressableOverlay onPress={() => setHide(!hide)} className="ml-2 px-1 py-1 rounded-md">
            {hide ? <Eye size={18} /> : <EyeOff size={18} />}
          </PressableOverlay>
        ) : (
          !!rightIcon && <View className="ml-2">{rightIcon}</View>
        )}
      </View>

      {!!error ? (
        <Text className="mt-1 text-danger">{error}</Text>
      ) : !!helper ? (
        <Muted className="mt-1">{helper}</Muted>
      ) : null}
    </View>
  )
}
