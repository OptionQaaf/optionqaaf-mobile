import type { SectionSize, SliderLinkItem } from "@/lib/shopify/services/home"
import { memo } from "react"

import { ImageLinkSlider } from "./ImageLinkSlider"

type Props = {
  items?: SliderLinkItem[]
  size?: SectionSize
  onPressItem?: (url: string | undefined, index: number) => void
}

export const CollectionLinkSlider = memo(function CollectionLinkSlider({ items, size, onPressItem }: Props) {
  if (!items?.length) return null
  return <ImageLinkSlider items={items} size={size} onPressItem={onPressItem} />
})
