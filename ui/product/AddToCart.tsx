import { Button } from "@/ui/primitives/Button"
import { Price } from "@/ui/product/Price"
import { View } from "react-native"
import { forwardRef } from "react"

type Props = {
  price: number
  compareAt?: number
  currency?: string
  onAdd?: () => void
  available?: boolean
  oosLabel?: string
  className?: string
  loading?: boolean
}

// Inline, pill-style Add to Cart row
export const AddToCart = forwardRef<View, Props>(function AddToCart({
  price,
  compareAt,
  currency = "USD",
  onAdd,
  available = true,
  oosLabel = "Out of stock",
  className,
  loading = false,
}, ref) {
  return (
    <View ref={ref} className={["rounded-3xl bg-surface border border-border px-4 py-3", className].filter(Boolean).join(" ")}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Price amount={price} compareAt={compareAt} currency={currency} amountClassName="text-[20px]" />
        </View>
        <Button
          onPress={onAdd}
          size="lg"
          className={`px-6 rounded-full ${!available || loading ? "bg-neutral-300" : ""}`}
          textClassName="font-bold"
          disabled={!available || loading}
        >
          {!available ? oosLabel : "Add to Cart"}
        </Button>
      </View>
    </View>
  )
})
