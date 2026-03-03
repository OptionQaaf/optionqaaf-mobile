import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useRecentlyViewedProducts } from "@/features/personalization/recentlyViewed"
import { usePersonalizationEvents } from "@/store/personalizationEvents"
import type { WishlistItem } from "@/store/wishlist"
import { useWishlist } from "@/store/wishlist"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { padToFullRow } from "@/ui/layout/gridUtils"
import { Screen } from "@/ui/layout/Screen"
import { DOCK_HEIGHT } from "@/ui/nav/dockConstants"
import { Button } from "@/ui/primitives/Button"
import { ProductTile } from "@/ui/product/ProductTile"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { Card } from "@/ui/surfaces/Card"
import { cn } from "@/ui/utils/cva"
import { useRouter } from "expo-router"
import { Star, Trash2 } from "lucide-react-native"
import { useCallback, useMemo } from "react"
import { ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function RecentlyViewedScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/recently-viewed" as const)} />}
    >
      <Screen bleedBottom>
        <RecentlyViewedContent />
      </Screen>
    </AuthGate>
  )
}

function RecentlyViewedContent() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { show } = useToast()
  const { data: products, isLoading } = useRecentlyViewedProducts(48)
  const clearRecentlyViewedOnly = usePersonalizationEvents((state) => state.clearRecentlyViewedOnly)

  const wishlistItems = useWishlist((state) => state.items)
  const toggleWishlist = useWishlist((state) => state.toggle)

  const bottomPadding = insets.bottom + DOCK_HEIGHT + 24
  const gridData = useMemo(() => padToFullRow(products, 2), [products])

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

  const handleToggleWishlist = useCallback(
    (product: (typeof products)[number]) => {
      const payload: WishlistItem = {
        productId: product.productId,
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
        imageUrl: product.imageUrl,
        price: { amount: product.price, currencyCode: product.currencyCode },
        variantTitle: null,
      }

      const currentlyWishlisted = wishlistItems.some((item) => item.productId === product.productId)
      toggleWishlist(payload)
      show({
        title: currentlyWishlisted ? "Removed from wishlist" : "Added to wishlist",
        type: currentlyWishlisted ? "info" : "success",
      })
    },
    [show, toggleWishlist, wishlistItems],
  )

  const handleClear = useCallback(() => {
    clearRecentlyViewedOnly()
    show({ title: "Recently viewed cleared", type: "info" })
  }, [clearRecentlyViewedOnly, show])

  if (!gridData.length && !isLoading) {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingBottom: bottomPadding,
        }}
        className="bg-[#f8fafc]"
      >
        <Card padding="lg" className="gap-3 items-center bg-[#f8fafc]">
          <Text className="text-[#0f172a] font-geist-semibold text-[18px] text-center">No recently viewed items</Text>
          <Text className="text-[#64748b] text-[13px] text-center">
            Products you view without adding to cart or wishlist will appear here.
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
      className="bg-[#f8fafc]"
    >
      <View className="px-5 pt-6 gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-[#0f172a] font-geist-semibold text-[20px]">Recently viewed</Text>
            <Text className="text-[#64748b] text-[13px]">Products you viewed but did not save yet.</Text>
          </View>
          <Button variant="outline" size="sm" onPress={handleClear} leftIcon={<Trash2 size={14} color="#111827" />}>
            Clear
          </Button>
        </View>

        <StaticProductGrid
          data={gridData}
          gap={8}
          renderItem={(item, itemWidth) => {
            if (!item) return <View style={{ width: itemWidth }} />

            const isWishlisted = wishlistItems.some((entry) => entry.productId === item.productId)

            return (
              <View className="relative">
                <ProductTile
                  width={itemWidth}
                  image={item.imageUrl || "https://images.unsplash.com/photo-1542291026-7eec264c27ff"}
                  brand={item.vendor ?? ""}
                  title={item.title}
                  price={item.price}
                  currency={item.currencyCode}
                  onPress={() => handleOpen(item.handle)}
                />
                <PressableOverlay
                  accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  onPress={() => handleToggleWishlist(item)}
                  className={cn(
                    "absolute top-2 right-2 h-8 w-8 rounded-full bg-white/95",
                    "items-center justify-center border border-[#e2e8f0]",
                  )}
                >
                  <Star
                    size={17}
                    color={isWishlisted ? "#f59e0b" : "#1f2937"}
                    fill={isWishlisted ? "#f59e0b" : "transparent"}
                    strokeWidth={1.5}
                  />
                </PressableOverlay>
              </View>
            )
          }}
        />
      </View>
    </ScrollView>
  )
}
