import { cn } from "@/ui/utils/cva"
import DropDownPicker from "react-native-dropdown-picker"
import { useEffect, useMemo, useState } from "react"
import { Platform, Text, View } from "react-native"

export type DropdownOption = { id: string; label: string; disabled?: boolean }

export function Dropdown({
  label,
  placeholder = "Select…",
  value,
  options,
  onChange,
  className,
  buttonClassName: _buttonClassName, // kept for backward compatibility but styling handled via hasError
  disabled,
  searchable = false,
  searchPlaceholder = "Search…",
  hasError = false,
}: {
  label?: string
  placeholder?: string
  value?: string
  options: DropdownOption[]
  onChange?: (id: string) => void
  className?: string
  buttonClassName?: string
  disabled?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  hasError?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(() =>
    options.map((option) => ({ label: option.label, value: option.id, disabled: option.disabled })),
  )

  useEffect(() => {
    setItems(options.map((option) => ({ label: option.label, value: option.id, disabled: option.disabled })))
  }, [options])

  const containerZIndex = useMemo(() => (open ? 2000 : 1), [open])
  const buttonProps = useMemo(() => ({ activeOpacity: 1 }), [])

  return (
    <View className={cn("w-full", className)} style={{ zIndex: containerZIndex }}>
      {!!label && (
        <Text className="mb-2 text-primary" selectable={false}>
          {label}
        </Text>
      )}

      <DropDownPicker
        open={open}
        setOpen={setOpen}
        value={value ?? null}
        setValue={(next) => {
          const resolved = typeof next === "function" ? next(value ?? null) : next
          if (resolved && onChange) {
            onChange(resolved)
          }
          return resolved
        }}
        items={items}
        setItems={setItems}
        placeholder={placeholder}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        listMode="SCROLLVIEW"
        autoScroll
        dropDownDirection={Platform.OS === "android" ? "AUTO" : "DEFAULT"}
        disabled={disabled}
        showArrowIcon={!disabled}
        keyboardShouldPersistTaps="handled"
        scrollViewProps={{ keyboardShouldPersistTaps: "handled" }}
        props={buttonProps}
        style={{
          borderRadius: 12,
          minHeight: 48,
          backgroundColor: disabled ? "#e2e8f0" : "#ffffff",
          borderColor: hasError ? "#ef4444" : "#e2e8f0",
          borderWidth: 1,
        }}
        placeholderStyle={{ color: "#94a3b8" }}
        labelStyle={{ color: "#0f172a" }}
        textStyle={{ color: "#0f172a" }}
        dropDownContainerStyle={{
          borderRadius: 12,
          borderColor: "#e2e8f0",
          backgroundColor: "#ffffff",
          overflow: "hidden",
        }}
        listItemContainerStyle={{ paddingVertical: 12 }}
        arrowIconStyle={{ display: disabled ? "none" : "flex" }}
        searchContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: "#ffffff",
          borderBottomColor: "#e2e8f0",
          borderBottomWidth: searchable ? 1 : 0,
        }}
        searchTextInputStyle={{
          backgroundColor: "#ffffff",
          borderColor: "#e2e8f0",
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          color: "#0f172a",
        }}
        disabledStyle={{ backgroundColor: "#e2e8f0" }}
        modalAnimationType="fade"
      />
    </View>
  )
}
