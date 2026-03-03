import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useWishlist } from "@/store/wishlist"
import { useToast } from "@/ui/feedback/Toast"
import { padToFullRow } from "@/ui/layout/gridUtils"
import { Screen } from "@/ui/layout/Screen"
import { DOCK_HEIGHT } from "@/ui/nav/dockConstants"
import { Button } from "@/ui/primitives/Button"
import { ProductTile } from "@/ui/product/ProductTile"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { WishlistRibbonButton } from "@/ui/product/WishlistRibbonButton"
import { Card } from "@/ui/surfaces/Card"
import { useRouter } from "expo-router"
import { useCallback, useMemo } from "react"
import { ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

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
  const insets = useSafeAreaInsets()

  const gridData = useMemo(() => padToFullRow(items, 2), [items])
  const bottomPadding = insets.bottom + DOCK_HEIGHT + 24

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
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingTop: 52,
          paddingBottom: bottomPadding,
        }}
        scrollIndicatorInsets={{ top: 52, bottom: bottomPadding }}
        className="bg-white"
      >
        <Card padding="sm" className="gap-3 items-center bg-white">
          <Text className="text-[#0f172a] font-geist-semibold text-[18px] text-center">Your wishlist is empty</Text>
          <Text className="text-[#64748b] text-[13px] text-center">
            Tap the heart icon on any product detail page to save it here for quick access later.
          </Text>
          <Button onPress={() => router.push("/home" as const)}>Continue shopping</Button>
        </Card>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 52, paddingBottom: bottomPadding }}
      scrollIndicatorInsets={{ top: 52, bottom: bottomPadding }}
      className="bg-white"
    >
      <View className="px-5 pt-6 gap-6">
        <View className="gap-2">
          <Text className="text-[#0f172a] font-geist-semibold text-[20px]">Wishlist</Text>
          <Text className="text-[#64748b] text-[13px]">Saved products ready when you are.</Text>
        </View>

        <StaticProductGrid
          data={gridData}
          gap={8}
          horizontalInset={0}
          renderItem={(item, itemWidth) => {
            if (!item) return <View style={{ width: itemWidth }} />

            const price = item.price?.amount ?? 0
            const currency = item.price?.currencyCode ?? "USD"
            return (
              <ProductTile
                width={itemWidth}
                image={item.imageUrl || "https://images.unsplash.com/photo-1542291026-7eec264c27ff"}
                brand={item.vendor ?? ""}
                title={item.title}
                price={price}
                currency={currency}
                onPress={() => handleOpen(item.handle)}
                imageOverlayPositionClassName="right-0 top-3"
                imageOverlay={
                  <WishlistRibbonButton
                    active
                    accessibilityLabel="Remove from wishlist"
                    onPress={() => {
                      toggle(item)
                      show({ title: "Removed from wishlist", type: "info" })
                    }}
                  />
                }
              />
            )
          }}
        />
      </View>
    </ScrollView>
  )
}
