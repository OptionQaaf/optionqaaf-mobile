import { cn } from "@/ui/utils/cva"
import { Heart } from "lucide-react-native"
import { Pressable } from "react-native"

type WishlistRibbonButtonProps = {
  active: boolean
  onPress: () => void
  accessibilityLabel: string
}

export function WishlistRibbonButton({ active, onPress, accessibilityLabel }: WishlistRibbonButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={cn(
        "h-9 min-w-[44px] rounded-l-md rounded-r-none bg-white/95 px-2",
        "items-center justify-center border border-r-0 border-[#e2e8f0]",
      )}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Heart
        size={17}
        color={active ? "#ef4444" : "#1f2937"}
        fill={active ? "#ef4444" : "transparent"}
        strokeWidth={1.5}
      />
    </Pressable>
  )
}
