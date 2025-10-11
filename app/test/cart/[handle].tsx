import { shopifyClient } from "@/lib/shopify/client"
import {
  CartCreateDocument,
  type CartCreateMutation,
  CartLinesAddDocument,
  type CartLinesAddMutation,
  CartQueryDocument,
  type CartQueryQuery,
  ProductByHandleDocument,
  type ProductByHandleQuery,
} from "@/lib/shopify/gql/graphql"
import { useCartId } from "@/store/cartId"
import { currentLocale } from "@/store/prefs"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useLocalSearchParams } from "expo-router"
import { Alert, Pressable, Text, View } from "react-native"

export default function CartTestScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const locale = currentLocale()
  const qc = useQueryClient()
  const { cartId, setCartId } = useCartId()

  // 1) Load product to get a variant
  const productQ = useQuery({
    queryKey: ["cart-test-product", handle, locale],
    enabled: !!handle,
    queryFn: async () =>
      shopifyClient.request<ProductByHandleQuery>(ProductByHandleDocument, {
        handle: handle!,
        country: locale.country as any,
        language: locale.language as any,
      }),
  })

  // 2) Ensure cart
  const ensureCart = useMutation({
    mutationFn: async () => {
      if (cartId) return cartId
      const res = await shopifyClient.request<CartCreateMutation>(CartCreateDocument, {
        country: locale.country as any,
        language: locale.language as any,
      })
      const id = res.cartCreate?.cart?.id!
      setCartId(id)
      return id
    },
  })

  // 3) Add a line (first variant)
  const addLine = useMutation({
    mutationFn: async () => {
      const id = cartId ?? (await ensureCart.mutateAsync())
      const variantId = productQ.data?.product?.variants?.nodes?.[0]?.id
      if (!variantId) throw new Error("No variant found on product")
      const res = await shopifyClient.request<CartLinesAddMutation>(CartLinesAddDocument, {
        cartId: id,
        lines: [{ merchandiseId: variantId, quantity: 1 }],
        country: locale.country as any,
        language: locale.language as any,
      })
      if (res.cartLinesAdd?.userErrors?.length) {
        throw new Error(res.cartLinesAdd.userErrors.map((e) => e.message).join("; "))
      }
      await qc.invalidateQueries({ queryKey: ["cart", id] })
      return res.cartLinesAdd?.cart
    },
    onError: (e: any) => Alert.alert("Add to Cart failed", e.message ?? String(e)),
  })

  // 4) Query cart for display
  const cartQ = useQuery({
    enabled: !!cartId,
    queryKey: ["cart", cartId],
    queryFn: async () => {
      if (!cartId) return null
      const res = await shopifyClient.request<CartQueryQuery>(CartQueryDocument, {
        id: cartId,
        country: locale.country as any,
        language: locale.language as any,
      })
      return res.cart
    },
  })

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Cart Smoke Test</Text>

      <Text>Product: {productQ.data?.product?.title ?? "(loading…)"}</Text>
      <Text>Cart ID: {cartId ?? "(none yet)"}</Text>
      <Text>Total Qty: {cartQ.data?.totalQuantity ?? 0}</Text>
      <Text>Checkout: {cartQ.data?.checkoutUrl ?? "(—)"} </Text>

      <Pressable onPress={() => addLine.mutate()} style={{ backgroundColor: "#111", padding: 12, borderRadius: 8 }}>
        <Text style={{ color: "white", textAlign: "center" }}>Add 1x first variant</Text>
      </Pressable>
    </View>
  )
}
