import type { SectionSize } from "@/lib/shopify/services/home"

const SIZE_SCALE: Record<SectionSize, number> = {
  small: 0.5,
  medium: 1,
  large: 1.5,
}

export function sizeScale(size?: SectionSize) {
  if (!size) return SIZE_SCALE.medium
  return SIZE_SCALE[size] ?? SIZE_SCALE.medium
}
