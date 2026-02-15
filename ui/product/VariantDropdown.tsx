import { Dropdown, type DropdownOption } from "@/ui/primitives/Dropdown"

export type VariantOption = DropdownOption
type Props = {
  label?: string
  options: VariantOption[]
  value?: string
  onChange?: (id: string) => void
  className?: string
  dropDownDirection?: "AUTO" | "TOP" | "BOTTOM"
  maxHeight?: number
}

export function VariantDropdown(props: Props) {
  return <Dropdown placeholder="Select option" {...props} />
}
