import { cn } from "@/ui/utils/cva"
import { Check } from "lucide-react-native"
import DropdownSelect from "react-native-input-select"
import { Text, View } from "react-native"

export type VariantOption = { id: string; label: string; disabled?: boolean }
type Props = {
  label?: string
  options: VariantOption[]
  value?: string
  onChange?: (id: string) => void
  className?: string
  dropDownDirection?: "AUTO" | "TOP" | "BOTTOM"
  maxHeight?: number
}

export function VariantDropdown({
  label,
  options,
  value,
  onChange,
  className,
  dropDownDirection: _dropDownDirection,
  maxHeight,
}: Props) {
  return (
    <View className={cn("w-full", className)}>
      {!!label && (
        <Text className="mb-2 text-primary" selectable={false}>
          {label}
        </Text>
      )}
      <DropdownSelect
        placeholder="Select option"
        options={options}
        optionLabel="label"
        optionValue="id"
        selectedValue={value}
        onValueChange={(itemValue) => {
          if (typeof itemValue === "string") {
            onChange?.(itemValue)
          }
        }}
        primaryColor="#0f172a"
        dropdownStyle={{
          borderRadius: 12,
          minHeight: 44,
          borderWidth: 1,
          borderColor: "#e2e8f0",
          backgroundColor: "#ffffff",
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
        dropdownContainerStyle={{
          backgroundColor: "#ffffff",
          marginBottom: 0,
        }}
        dropdownIconStyle={{
          right: 14,
          top: "50%",
          marginTop: -4,
        }}
        selectedItemStyle={{
          color: "#0f172a",
        }}
        placeholderStyle={{
          color: "#0f172a",
        }}
        checkboxControls={{
          checkboxSize: 16,
          checkboxStyle: {
            borderWidth: 0,
            backgroundColor: "transparent",
            padding: 0,
          },
          checkboxUnselectedColor: "transparent",
          checkboxComponent: <Check size={14} color="#0f172a" strokeWidth={2.5} />,
        }}
        modalControls={{
          modalOptionsContainerStyle: maxHeight ? { maxHeight } : undefined,
          modalProps: {
            animationType: "fade",
            hardwareAccelerated: true,
          },
        }}
      />
    </View>
  )
}
