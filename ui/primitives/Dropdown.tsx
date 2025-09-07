// ui/primitives/Dropdown.tsx
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { cn } from "@/ui/utils/cva"
import { Check, ChevronDown, X } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { FlatList, type ListRenderItem, Modal, Pressable, Text, useWindowDimensions, View } from "react-native"
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export type DropdownOption = { id: string; label: string; disabled?: boolean }

export function Dropdown({
  label,
  placeholder = "Select…",
  value,
  options,
  onChange,
  className,
  buttonClassName,
  disabled,
}: {
  label?: string
  placeholder?: string
  value?: string
  options: DropdownOption[]
  onChange?: (id: string) => void
  className?: string
  buttonClassName?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const progress = useSharedValue(0)
  const selected = useMemo(() => options.find((o) => o.id === value)?.label, [options, value])
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const openSheet = () => {
    setMounted(true)
    progress.value = withTiming(1, { duration: 140 })
  }
  const closeSheet = () => {
    progress.value = withTiming(0, { duration: 140 }, (f) => {
      if (f) runOnJS(setMounted)(false)
    })
  }
  useEffect(() => {
    open ? openSheet() : closeSheet()
  }, [open])

  const scrimStyle = useAnimatedStyle(() => ({ opacity: 0.4 * progress.value }))
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 16 }],
    opacity: progress.value,
  }))

  const renderItem: ListRenderItem<DropdownOption> = ({ item }) => {
    const isSelected = item.id === value
    return (
      <Pressable
        disabled={item.disabled}
        onPress={() => {
          onChange?.(item.id)
          setOpen(false)
        }}
        className={cn("flex-row items-center justify-between px-4 h-12", item.disabled && "opacity-40")}
      >
        <Text className="text-primary">{item.label}</Text>
        {isSelected ? <Check size={18} color="#0B0B0B" /> : null}
      </Pressable>
    )
  }

  return (
    <View className={cn("w-full", className)}>
      {!!label && <Text className="mb-2 text-primary">{label}</Text>}

      <PressableOverlay
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          "w-full h-12 rounded-xl bg-surface border border-border px-3 flex-row items-center justify-between",
          buttonClassName,
        )}
      >
        <>
          <Text className={cn(selected ? "text-primary" : "text-muted")}>{selected ?? placeholder}</Text>
          <ChevronDown size={18} color="#0B0B0B" />
        </>
      </PressableOverlay>

      <Modal
        visible={mounted}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
      >
        {/* SCRIM */}
        <Pressable className="absolute inset-0" onPress={() => setOpen(false)}>
          <Animated.View style={scrimStyle} className="flex-1 bg-black" />
        </Pressable>

        {/* SHEET */}
        <Animated.View style={panelStyle} className="absolute inset-x-0 bottom-0">
          {/* Use a plain View for the rounded container and clip children */}
          <View className="bg-surface border-t border-border rounded-t-2xl overflow-hidden">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
              <Text className="text-primary font-geist-semibold text-[16px]">{label ?? "Select"}</Text>
              <PressableOverlay className="px-2 py-1 rounded-md" onPress={() => setOpen(false)}>
                <X size={18} />
              </PressableOverlay>
            </View>

            {/* Options list */}
            <FlatList
              data={options}
              keyExtractor={(o) => o.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View className="h-px bg-border" />}
              bounces={false}
              overScrollMode="never"
              // Cap height so it never pushes into the top too far
              style={{ maxHeight: Math.round(height * 0.6) - insets.bottom }}
              // <-- The important part: keep content clear of the bottom inset
              contentContainerStyle={{
                paddingBottom: insets.bottom + 12, // leaves space above the home indicator
                paddingHorizontal: 0,
              }}
              // Also lift the scroll indicators
              scrollIndicatorInsets={{ bottom: insets.bottom + 12 }}
            />
          </View>
        </Animated.View>
      </Modal>
    </View>
  )
}
