import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useWishlist } from "@/store/wishlist"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { padToFullRow } from "@/ui/layout/gridUtils"
import { Screen } from "@/ui/layout/Screen"
import { Button } from "@/ui/primitives/Button"
import { ProductTile } from "@/ui/product/ProductTile"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { Card } from "@/ui/surfaces/Card"
import { cn } from "@/ui/utils/cva"
import { useRouter } from "expo-router"
import { Star } from "lucide-react-native"
import { useCallback, useMemo } from "react"
import { ScrollView, Text, View } from "react-native"

export default function WishlistScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/wishlist" as const)} />}
    >
      <Screen bleedBottom>
        <WishlistContent />
      </Screen>
    </AuthGate>
  )
}

function WishlistContent() {
  const items = useWishlist((s) => s.items)
  const toggle = useWishlist((s) => s.toggle)
  const router = useRouter()
  const { show } = useToast()

  const gridData = useMemo(() => padToFullRow(items, 2), [items])

  const handleOpen = useCallback(
    (handle?: string | null) => {
      if (!handle) {
        show({ title: "Product unavailable", type: "info" })
        return
      }
      router.push(`/products/${handle}` as const)
    },
    [router, show],
  )

  if (!gridData.length) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: "center" }}>
        <Card padding="lg" className="gap-3 items-center bg-[#f8fafc]">
          <Text className="text-[#0f172a] font-geist-semibold text-[18px] text-center">Your wishlist is empty</Text>
          <Text className="text-[#64748b] text-[13px] text-center">
            Tap the star icon on any product detail page to save it here for quick access later.
          </Text>
          <Button onPress={() => router.push("/home" as const)}>Continue shopping</Button>
        </Card>
      </ScrollView>
    )
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 20, gap: 24 }}>
      <View className="gap-2">
        <Text className="text-[#0f172a] font-geist-semibold text-[20px]">Wishlist</Text>
        <Text className="text-[#64748b] text-[13px]">Saved products ready when you are.</Text>
      </View>

      <StaticProductGrid
        data={gridData}
        gap={8}
        renderItem={(item, itemWidth) => {
          if (!item) return <View style={{ width: itemWidth }} />

          const price = item.price?.amount ?? 0
          const currency = item.price?.currencyCode ?? "USD"
          return (
            <View className="relative">
              <ProductTile
                width={itemWidth}
                image={item.imageUrl || "https://images.unsplash.com/photo-1542291026-7eec264c27ff"}
                brand={item.vendor ?? ""}
                title={item.title}
                price={price}
                currency={currency}
                onPress={() => handleOpen(item.handle)}
              />
              <PressableOverlay
                accessibilityLabel="Remove from wishlist"
                onPress={() => {
                  toggle(item)
                  show({ title: "Removed from wishlist", type: "info" })
                }}
                className={cn("absolute top-2 right-2 h-8 w-8 rounded-full bg-white/95", "items-center justify-center")}
              >
                <Star size={18} color="#f59e0b" fill="#f59e0b" strokeWidth={1.5} />
              </PressableOverlay>
            </View>
          )
        }}
      />
    </ScrollView>
  )
}
