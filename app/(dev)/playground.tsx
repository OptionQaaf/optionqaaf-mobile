import { NumberKnob, Segment, Toggle } from "@/ui/dev/Knobs"
import { Story, Swatch } from "@/ui/dev/Story"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { Badge } from "@/ui/primitives/Badge"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { H1, Muted } from "@/ui/primitives/Typography"
import { Price } from "@/ui/product/Price"
import { ProductTile } from "@/ui/product/ProductTile"
import { QuantityStepper } from "@/ui/product/QuantityStepper"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { VariantDropdown } from "@/ui/product/VariantDropdown"
import { SectionHeader } from "@/ui/sections/SectionHeader"
import { Heart, Search, ShoppingBag } from "lucide-react-native"
import { useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function Playground() {
  const toast = useToast()

  // button knobs
  const [variant, setVariant] = useState<"solid" | "outline" | "ghost" | "link">("solid")
  const [size, setSize] = useState<"sm" | "md" | "lg">("md")
  const [full, setFull] = useState(false)
  const [loading, setLoading] = useState(false)

  // price knobs
  const [price, setPrice] = useState(48)
  const [compare, setCompare] = useState(88)

  // quantity knob
  const [qty, setQty] = useState(1)

  const insets = useSafeAreaInsets()

  return (
    <Screen bleedBottom>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: insets.bottom,
        }}
      >
        <H1>Playground</H1>

        <Story title="Tokens">
          <View className="flex-row flex-wrap gap-6">
            <Swatch name="base" className="bg-base" />
            <Swatch name="surface" className="bg-surface" />
            <Swatch name="border" className="bg-border" />
            <Swatch name="brand" className="bg-brand" />
            <Swatch name="elev" className="bg-elev" />
          </View>
        </Story>

        <Story title="Button">
          <View className="flex-row items-center gap-3 mb-3">
            <Segment
              options={["solid", "outline", "ghost", "link"]}
              value={variant}
              onChange={(v) => setVariant(v as any)}
            />
            <Segment options={["sm", "md", "lg"]} value={size} onChange={(v) => setSize(v as any)} />
            <Toggle label="Full width" value={full} onChange={setFull} />
            <Toggle label="Loading" value={loading} onChange={setLoading} />
          </View>
          <Button
            variant={variant}
            size={size}
            fullWidth={full}
            isLoading={loading}
            leftIcon={<ShoppingBag size={18} color={variant === "solid" ? "white" : undefined} />}
            onPress={() => toast.show({ title: "Tapped button", type: "info" })}
          >
            Add to Cart
          </Button>
        </Story>

        <Story title="Input + Dropdown + Quantity">
          <View className="gap-4">
            <Input label="Search" placeholder="Hoodies" leftIcon={<Search size={18} />} />
            <VariantDropdown
              label="Size"
              options={[
                { id: "s", label: "S" },
                { id: "m", label: "M" },
                { id: "l", label: "L" },
                { id: "xl", label: "XL", disabled: true },
              ]}
              onChange={() => {}}
            />
            <View className="flex-row items-center justify-between">
              <NumberKnob label="Price" value={price} min={1} max={200} onChange={setPrice} />
              <NumberKnob label="Compare" value={compare} min={0} max={200} onChange={setCompare} />
            </View>
            <QuantityStepper value={qty} onChange={setQty} />
            <Price amount={price} compareAt={compare} currency="USD" />
          </View>
        </Story>

        <Story title="Badges & Skeleton">
          <View className="flex-row items-center gap-2 mb-4">
            <Badge>New</Badge>
            <Badge variant="brand">Brand</Badge>
            <Badge variant="success">In Stock</Badge>
            <Badge variant="danger">Error</Badge>
          </View>
          <View className="flex-row gap-3">
            <Skeleton className="w-16 h-16 rounded-xl" />
            <View className="flex-1 gap-2">
              <Skeleton className="h-4" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </View>
          </View>
        </Story>
        <StaticProductGrid
          data={[
            { image: "https://…1", brand: "UNIQLO", title: "Utility Hoodie", price: 39, compareAt: 59 },
            { image: "https://…2", brand: "MADEXTREME", title: "Heavy Cotton Tee", price: 19 },
            { image: "https://…3", brand: "NMK", title: "Boxy Overshirt", price: 49 },
          ]}
          columns={2}
          gap={12}
          renderItem={(item, itemWidth) => (
            <ProductTile {...item} width={itemWidth} titleLines={2} rounded="3xl" padding="md" />
          )}
        />
        <Story title="Product Tile & Section">
          <SectionHeader title="You might also like" />
          <View className="mt-3">
            <Button variant="outline" leftIcon={<Heart size={18} />}>
              Wishlist
            </Button>
          </View>
          <Muted className="mt-3">Tap buttons to see haptics & toasts.</Muted>
        </Story>
      </ScrollView>
    </Screen>
  )
}
