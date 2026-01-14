import { cn } from "@/ui/utils/cva"
import { useEffect, useMemo, useRef, useState } from "react"
import { Dimensions, Modal, Platform, Pressable, Text, View } from "react-native"
import DropDownPicker from "react-native-dropdown-picker"

export type DropdownOption = { id: string; label: string; disabled?: boolean }

type DropdownListener = (activeId: string | null) => void

const dropdownListeners = new Set<DropdownListener>()
let activeDropdownId: string | null = null

function broadcastActiveDropdown(id: string | null) {
  activeDropdownId = id
  dropdownListeners.forEach((listener) => listener(id))
}

export function Dropdown({
  label,
  placeholder = "Select…",
  value,
  options,
  onChange,
  className,
  buttonClassName: _buttonClassName,
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
  const instanceId = useRef(`dropdown-${Math.random().toString(36).slice(2, 10)}`)
  const [items, setItems] = useState(() =>
    options.map((option) => ({ label: option.label, value: option.id, disabled: option.disabled })),
  )

  useEffect(() => {
    const handleActiveChange = (activeId: string | null) => {
      if (activeId && activeId !== instanceId.current) {
        setOpen(false)
      }
    }
    dropdownListeners.add(handleActiveChange)
    return () => {
      dropdownListeners.delete(handleActiveChange)
    }
  }, [])

  useEffect(() => {
    setItems(options.map((option) => ({ label: option.label, value: option.id, disabled: option.disabled })))
  }, [options])

  const containerZIndex = useMemo(() => (open ? 2000 : 1), [open])
  const isAndroid = Platform.OS === "android"
  const listMode = isAndroid ? "SCROLLVIEW" : "SCROLLVIEW"
  const selectedLabel = useMemo(() => items.find((i) => i.value === (value ?? null))?.label ?? "", [items, value])
  const maxPickerHeight = useMemo(() => Math.max(220, Math.floor(Dimensions.get("window").height * 0.4)), [])

  useEffect(() => {
    if (open) {
      broadcastActiveDropdown(instanceId.current)
      return
    }
    if (activeDropdownId === instanceId.current) {
      broadcastActiveDropdown(null)
    }
  }, [open])

  if (isAndroid) {
    return (
      <View className={cn("w-full", className)} style={{ zIndex: containerZIndex }}>
        {!!label && (
          <Text className="mb-2 text-primary" selectable={false}>
            {label}
          </Text>
        )}
        <Pressable
          onPress={() => setOpen(true)}
          disabled={disabled}
          style={({ pressed }) => [
            {
              borderRadius: 12,
              minHeight: 48,
              backgroundColor: disabled ? "#e2e8f0" : "#ffffff",
              borderColor: hasError ? "#ef4444" : "#e2e8f0",
              borderWidth: 1,
              paddingHorizontal: 12,
              justifyContent: "center",
              opacity: pressed ? 1 : 1,
            },
          ]}
        >
          <Text style={{ color: selectedLabel ? "#0f172a" : "#0f172a" }}>{selectedLabel || placeholder}</Text>
        </Pressable>
        <Modal
          visible={open}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }} onPress={() => setOpen(false)} />
          <View
            style={{
              backgroundColor: "#ffffff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 16,
              maxHeight: "50%",
              width: "100%",
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              borderColor: "#e2e8f0",
              borderWidth: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Pressable onPress={() => setOpen(false)} style={{ padding: 8 }}>
                <Text style={{ color: "#0f172a", fontWeight: "700" }}>✕</Text>
              </Pressable>
              <Text style={{ color: "#0f172a", fontWeight: "700", marginLeft: 4 }}>Select</Text>
            </View>
            <View style={{ gap: 4 }}>
              {items.map((item) => {
                const active = value === item.value
                return (
                  <Pressable
                    key={item.value}
                    disabled={item.disabled}
                    onPress={() => {
                      if (item.disabled) return
                      setOpen(false)
                      onChange?.(item.value as string)
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderRadius: 10,
                      backgroundColor: active ? "#f1f5f9" : "#ffffff",
                      borderColor: "#e2e8f0",
                      borderWidth: 1,
                      opacity: item.disabled ? 0.5 : pressed ? 1 : 1,
                    })}
                  >
                    <Text style={{ color: "#0f172a", fontWeight: "600" }}>{item.label}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        </Modal>
      </View>
    )
  }

  // iOS (and other platforms) use DropDownPicker's default behavior
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
        listMode={listMode}
        dropDownDirection="AUTO"
        maxHeight={maxPickerHeight}
        autoScroll
        disabled={disabled}
        showArrowIcon={!disabled}
        onClose={() => setOpen(false)}
        style={{
          borderRadius: 12,
          minHeight: 48,
          backgroundColor: disabled ? "#e2e8f0" : "#ffffff",
          borderColor: hasError ? "#ef4444" : "#e2e8f0",
          borderWidth: 1,
        }}
        placeholderStyle={{ color: "#0f172a" }}
        labelStyle={{ color: "#0f172a" }}
        textStyle={{ color: "#0f172a" }}
        dropDownContainerStyle={{
          borderRadius: 12,
          borderColor: "#e2e8f0",
          backgroundColor: "#ffffff",
          overflow: "hidden",
          paddingHorizontal: 0,
        }}
        listItemContainerStyle={{ paddingVertical: 12, paddingHorizontal: 8 }}
        listItemLabelStyle={{ color: "#0f172a", fontWeight: "600", paddingRight: 4 }}
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
