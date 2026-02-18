import { useDrawer } from "@/features/navigation/drawerContext"
import { useCartQuery } from "@/features/cart/api"
import { CartPreviewDrawer } from "@/ui/nav/CartPreviewDrawer"
import { Icon, MenuBar } from "@/ui/nav/MenuBar"
import { usePathname, useSegments } from "expo-router"
import { ShoppingBag } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Text, View } from "react-native"

const HIDDEN_PATHNAME_PATTERNS = [/^\/search(?:\/|$)/]

function shouldShowBack(pathname: string) {
  if (pathname === "/" || pathname === "/home" || pathname === "/account" || pathname === "/cart") {
    return false
  }
  return true
}

export function RootMenuBar() {
  const pathname = usePathname()
  const segments = useSegments()
  const { isOpen: isNavDrawerOpen } = useDrawer()
  const { data: cart } = useCartQuery()
  const [isCartPreviewOpen, setIsCartPreviewOpen] = useState(false)

  const isProductDetailPage = segments.length === 2 && segments[0] === "products"
  const qty = (cart?.totalQuantity ?? 0) > 99 ? 99 : (cart?.totalQuantity ?? 0)

  useEffect(() => {
    if (!isProductDetailPage || isNavDrawerOpen) {
      setIsCartPreviewOpen(false)
    }
  }, [isNavDrawerOpen, isProductDetailPage])

  if (!pathname) return null
  if (isNavDrawerOpen) return null
  if (HIDDEN_PATHNAME_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return null
  }

  return (
    <>
      <MenuBar
        floating
        back={shouldShowBack(pathname)}
        rightAccessory={
          isProductDetailPage ? (
            <View className="h-10 w-10 items-center justify-center">
              <Icon onPress={() => setIsCartPreviewOpen(true)} accessibilityLabel="Open cart preview">
                <ShoppingBag size={22} color="#1e1e1e" strokeWidth={1.8} />
              </Icon>
              {qty > 0 ? (
                <View className="absolute right-[1px] top-[1px] min-w-4 rounded-full bg-brand px-1 items-center justify-center">
                  <Text className="text-[10px] text-white font-geist-semibold" numberOfLines={1}>
                    {qty}
                    {qty === 99 ? "+" : ""}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : undefined
        }
      />

      {isProductDetailPage ? (
        <CartPreviewDrawer open={isCartPreviewOpen} onClose={() => setIsCartPreviewOpen(false)} />
      ) : null}
    </>
  )
}
