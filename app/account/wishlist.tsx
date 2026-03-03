import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useWishlist } from "@/store/wishlist"
import { useToast } from "@/ui/feedback/Toast"
import { padToFullRow } from "@/ui/layout/gridUtils"
import { Screen } from "@/ui/layout/Screen"
import { DOCK_HEIGHT } from "@/ui/nav/dockConstants"
import { Button } from "@/ui/primitives/Button"
import { ProductTile } from "@/ui/product/ProductTile"
import { WishlistRibbonButton } from "@/ui/product/WishlistRibbonButton"
import { Card } from "@/ui/surfaces/Card"
import { FlashList } from "@shopify/flash-list"
import { useRouter } from "expo-router"
import { useCallback, useMemo } from "react"
import { Platform, ScrollView, Text, useWindowDimensions, View } from "react-native"
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
  const { width } = useWindowDimensions()

  const gridData = useMemo(() => padToFullRow(items, 2), [items])
  const bottomPadding = insets.bottom + DOCK_HEIGHT + 24
  const columns = 2
  const gap = 8
  const listPadding = 20
  const tileWidth = (width - listPadding * 2 - gap * (columns - 1)) / columns

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
    <FlashList
      bounces={Platform.OS === "ios" ? false : undefined}
      alwaysBounceVertical={Platform.OS === "ios" ? false : undefined}
      overScrollMode={Platform.OS === "android" ? "never" : undefined}
      data={gridData}
      numColumns={columns}
      keyExtractor={(item: any, index) => (item ? String(item.productId ?? item.handle ?? index) : `spacer-${index}`)}
      contentContainerStyle={{ paddingTop: 52, paddingBottom: bottomPadding, paddingHorizontal: listPadding }}
      scrollIndicatorInsets={{ top: 52, bottom: bottomPadding }}
      ListHeaderComponent={
        <View className="pt-6 gap-6 mb-2">
          <View className="gap-2">
            <Text className="text-[#0f172a] font-geist-semibold text-[20px]">Wishlist</Text>
            <Text className="text-[#64748b] text-[13px]">Saved products ready when you are.</Text>
          </View>
        </View>
      }
      renderItem={({ item, index }) => {
        const col = index % columns
        const marginRight = col < columns - 1 ? gap : 0
        if (!item) return <View style={{ width: tileWidth, marginRight, marginBottom: gap }} />
        const price = item.price?.amount ?? 0
        const currency = item.price?.currencyCode ?? "USD"
        return (
          <View style={{ width: tileWidth, marginRight, marginBottom: gap }}>
            <ProductTile
              width={tileWidth}
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
          </View>
        )
      }}
      showsVerticalScrollIndicator={false}
    />
  )
}
