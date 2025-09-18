import { Button } from "@/ui/primitives/Button"
import { Price } from "@/ui/product/Price"
import { View } from "react-native"
import { forwardRef } from "react"
import { SafeAreaView } from "react-native-safe-area-context"

type Props = {
  price: number
  compareAt?: number
  currency?: string
  onAdd?: () => void
  available?: boolean
  oosLabel?: string
  loading?: boolean
}

export const AddToCartBar = forwardRef<View, Props>(function AddToCartBar({
  price,
  compareAt,
  currency = "USD",
  onAdd,
  available = true,
  oosLabel = "Out of stock",
  loading = false,
}, ref) {
  return (
    <View ref={ref} pointerEvents="box-none" className="absolute left-0 right-0 bottom-0 bg-surface border-t border-border">
      <SafeAreaView edges={["bottom"]}>
        <View className="px-4 py-3 flex-row items-center gap-3">
          <View className="flex-1">
            <Price amount={price} compareAt={compareAt} currency={currency} amountClassName="text-[22px]" />
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
      </SafeAreaView>
    </View>
  )
})
