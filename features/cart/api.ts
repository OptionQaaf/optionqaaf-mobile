import { qk } from "@/lib/shopify/queryKeys"
import {
  addLines,
  createCart,
  getCart,
  removeLines,
  replaceCartDeliveryAddresses,
  updateBuyerIdentity,
  updateCartAttributes,
  updateCartNote,
  updateDiscountCodes,
  updateLines,
} from "@/lib/shopify/services/cart"
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
      qc.setQueryData(qk.cart(id) as any, res.cartCreate?.cart ?? null)
      return id
    },
  })
}

export function useAddToCart() {
  const locale = currentLocale()
  const { cartId, setCartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { merchandiseId: string; quantity: number }) => {
      const primeCart = (id: string, cart: any | null | undefined) => {
        if (cart) qc.setQueryData(qk.cart(id) as any, cart)
      }

      const ensureCartId = async () => {
        const existing = useCartId.getState().cartId
        if (existing) return existing
        const created = await createCart({}, locale)
        const newId = created.cartCreate?.cart?.id
        if (!newId) throw new Error("Failed to create cart")
        setCartId(newId)
        primeCart(newId, created.cartCreate?.cart ?? null)
        return newId
      }

      const addTo = async (id: string) => {
        const res = await addLines(id, [payload], locale)
        primeCart(id, res.cartLinesAdd?.cart)
        return res.cartLinesAdd?.cart ?? null
      }

      let id = cartId ?? (await ensureCartId())

      try {
        return await addTo(id)
      } catch (error: any) {
        const message = String(error?.message ?? "")
        if (!message.toLowerCase().includes("cart") || !message.toLowerCase().includes("exist")) throw error

        // Shopify purged the cart (e.g. after checkout). Start fresh.
        qc.removeQueries({ queryKey: qk.cart(id) as any })
        setCartId(null)
        const created = await createCart({}, locale)
        const newId = created.cartCreate?.cart?.id
        if (!newId) throw error
        setCartId(newId)
        primeCart(newId, created.cartCreate?.cart ?? null)
        return await addTo(newId)
      }
    },
    onSuccess: () => {
      const id = useCartId.getState().cartId
      if (id) qc.invalidateQueries({ queryKey: qk.cart(id) as any })
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
    // Optimistic: update ONLY quantity — never touch any price/cost fields.
    // Server is the sole authority for all money values.
    onMutate: async (payload) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<any>(key)
      if (!prev) return { prev }
      const cart = JSON.parse(JSON.stringify(prev))
      const line = (cart?.lines?.nodes ?? []).find((n: any) => n.id === payload.id)
      if (line) {
        const delta = payload.quantity - (Number(line.quantity) || 1)
        line.quantity = payload.quantity
        cart.totalQuantity = Math.max(0, (Number(cart.totalQuantity) || 0) + delta)
      }
      qc.setQueryData(key, cart)
      return { prev }
    },
    onError: (_e, _p, ctx) => {
      if (!cartId || !ctx?.prev) return
      qc.setQueryData(qk.cart(cartId) as any, ctx.prev)
    },
    onSuccess: (cart) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      if (cart) qc.setQueryData(key, cart)
      qc.invalidateQueries({ queryKey: key })
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
    // Optimistic: remove the paid line AND its associated BOGO/automatic free lines.
    // Free lines share the same merchandise.id and have canRemove=false + canUpdateQuantity=false.
    // Shopify removes them automatically when the qualifying paid line is removed, but the
    // mutation response may lag — removing them from the cache here keeps state coherent.
    onMutate: async (lineId) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<any>(key)
      if (!prev) return { prev }
      const cart = JSON.parse(JSON.stringify(prev))
      const nodes: any[] = cart?.lines?.nodes ?? []
      const targetLine = nodes.find((n: any) => n.id === lineId)
      if (!targetLine) {
        qc.setQueryData(key, cart)
        return { prev }
      }
      const merchandiseId = targetLine?.merchandise?.id
      // A line is an "automatic free line" for this merchandise if it shares
      // the same merchandise.id and Shopify has locked it (can't remove/update).
      const isAutoFreeLine = (n: any) =>
        merchandiseId &&
        n.merchandise?.id === merchandiseId &&
        n.id !== lineId &&
        n.instructions?.canRemove === false &&
        n.instructions?.canUpdateQuantity === false
      const linesToRemove = nodes.filter((n: any) => n.id === lineId || isAutoFreeLine(n))
      const removedQty = linesToRemove.reduce((sum: number, n: any) => sum + (Number(n.quantity) || 0), 0)
      const filtered = nodes.filter((n: any) => !linesToRemove.includes(n))
      cart.totalQuantity = Math.max(0, (Number(cart.totalQuantity) || 0) - removedQty)
      if (cart.lines?.nodes) cart.lines.nodes = filtered
      qc.setQueryData(key, cart)
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (!cartId || !ctx?.prev) return
      qc.setQueryData(qk.cart(cartId) as any, ctx.prev)
    },
    onSuccess: () => {
      if (!cartId) return
      // Intentionally do NOT set cache from the mutation response here.
      // cartLinesRemove may still include BOGO/automatic free lines for the
      // removed merchandise in its response — they only disappear on the next
      // full cart fetch. Setting intermediate state causes free lines to
      // visually reappear. Just invalidate; the screen awaits refetch().
      qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}

export function useUpdateDiscountCodes() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (codes: string[]) => {
      if (!cartId) throw new Error("Cart not initialized")
      const res = await updateDiscountCodes(cartId, codes, locale)
      return res.cartDiscountCodesUpdate?.cart ?? null
    },
    onSuccess: (cart) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      if (cart) qc.setQueryData(key, cart)
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useAttachCartToCustomer() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { customerAccessToken: string }) => {
      if (!cartId) throw new Error("Cart not initialized")
      const res = await updateBuyerIdentity(cartId, { customerAccessToken: payload.customerAccessToken }, locale)
      return res.cartBuyerIdentityUpdate?.cart ?? null
    },
    onSuccess: (cart) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      if (cart) qc.setQueryData(key, cart)
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useUpdateCartAttributes() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (attributes: { key: string; value: string }[]) => {
      if (!cartId) throw new Error("Cart not initialized")
      const res = await updateCartAttributes(cartId, attributes, locale)
      return res.cartAttributesUpdate?.cart ?? null
    },
    onSuccess: () => {
      if (!cartId) return
      qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}

export function useUpdateCartNote() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (note: string) => {
      if (!cartId) throw new Error("Cart not initialized")
      const res = await updateCartNote(cartId, note, locale)
      return res.cartNoteUpdate?.cart ?? null
    },
    onSuccess: () => {
      if (!cartId) return
      qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}

export function useReplaceCartDeliveryAddresses() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (
      addresses: { address: { copyFromCustomerAddressId: string }; selected?: boolean; oneTimeUse?: boolean }[],
    ) => {
      if (!cartId) throw new Error("Cart not initialized")
      const res = await replaceCartDeliveryAddresses(cartId, addresses, locale)
      return res.cartDeliveryAddressesReplace?.cart ?? null
    },
    onSuccess: () => {
      if (!cartId) return
      qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}
