import { qk } from "@/lib/shopify/queryKeys"
import { addLines, createCart, getCart, removeLines, updateLines } from "@/lib/shopify/services/cart"
import { useCartId } from "@/store/cartId"
import { currentLocale } from "@/store/prefs"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export function useCartQuery() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  return useQuery({
    enabled: !!cartId,
    queryKey: qk.cart(cartId),
    queryFn: async () => (cartId ? (await getCart(cartId, locale)).cart : null),
  })
}

export function useEnsureCart() {
  const locale = currentLocale()
  const { cartId, setCartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (cartId) return cartId
      const res = await createCart({}, locale)
      const id = res.cartCreate?.cart?.id!
      setCartId(id)
      await qc.invalidateQueries({ queryKey: qk.cart(id) as any })
      return id
    },
  })
}

export function useAddToCart() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { merchandiseId: string; quantity: number }) => {
      if (!cartId) throw new Error("Cart not initialized")
      const res = await addLines(cartId, [payload], locale)
      return res.cartLinesAdd?.cart ?? null
    },
    onSuccess: () => {
      if (cartId) qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}

export function useUpdateLine() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; quantity: number }) => {
      if (!cartId) throw new Error("Cart not initialized")
      const res = await updateLines(cartId, [payload], locale)
      return res.cartLinesUpdate?.cart ?? null
    },
    onSuccess: () => {
      if (cartId) qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}

export function useRemoveLine() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (lineId: string) => {
      if (!cartId) throw new Error("Cart not initialized")
      const res = await removeLines(cartId, [lineId], locale)
      return res.cartLinesRemove?.cart ?? null
    },
    onSuccess: () => {
      if (cartId) qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}
