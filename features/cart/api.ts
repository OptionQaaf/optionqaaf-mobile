import { qk } from "@/lib/shopify/queryKeys"
import { addLines, createCart, getCart, removeLines, updateDiscountCodes, updateLines } from "@/lib/shopify/services/cart"
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
    onMutate: async (payload) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<any>(key)
      if (!prev) return { prev }
      const cart = JSON.parse(JSON.stringify(prev))
      const nodes: any[] = cart?.lines?.nodes ?? []
      const line = nodes.find((n) => n.id === payload.id)
      if (!line) return { prev }
      const oldQty = Number(line.quantity ?? 1)
      const newQty = Number(payload.quantity ?? oldQty)
      const delta = newQty - oldQty
      line.quantity = newQty
      const unit = Number(line?.merchandise?.price?.amount ?? 0)
      // update line subtotal
      if (!line.cost) line.cost = {}
      line.cost.subtotalAmount = {
        ...(line.cost.subtotalAmount ?? { currencyCode: cart?.cost?.totalAmount?.currencyCode ?? "USD" }),
        amount: String((unit * newQty).toFixed(2)),
      }
      // recompute subtotal from lines
      const subtotal = nodes.reduce(
        (sum, l) => sum + Number(l?.merchandise?.price?.amount ?? 0) * Number(l?.quantity ?? 1),
        0,
      )
      if (!cart.cost) cart.cost = {}
      cart.cost.subtotalAmount = {
        ...(cart.cost.subtotalAmount ?? { currencyCode: cart?.cost?.totalAmount?.currencyCode ?? "USD" }),
        amount: String(subtotal.toFixed(2)),
      }
      // optimistic total: equal to recomputed subtotal (shipping 0; discounts synced on server refresh)
      cart.cost.totalAmount = {
        ...(cart.cost.totalAmount ?? { currencyCode: cart?.cost?.totalAmount?.currencyCode ?? "USD" }),
        amount: String(Math.max(0, subtotal).toFixed(2)),
      }
      cart.totalQuantity = Number(cart.totalQuantity ?? 0) + delta
      qc.setQueryData(key, cart)
      return { prev }
    },
    onError: (_e, _p, ctx) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
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
    onMutate: async (lineId) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<any>(key)
      if (!prev) return { prev }
      const cart = JSON.parse(JSON.stringify(prev))
      const nodes: any[] = cart?.lines?.nodes ?? []
      const idx = nodes.findIndex((n) => n.id === lineId)
      if (idx === -1) return { prev }
      const line = nodes[idx]
      const qty = Number(line?.quantity ?? 1)
      const unit = Number(line?.merchandise?.price?.amount ?? 0)
      nodes.splice(idx, 1)
      // recompute subtotal
      const subtotal = nodes.reduce(
        (sum, l) => sum + Number(l?.merchandise?.price?.amount ?? 0) * Number(l?.quantity ?? 1),
        0,
      )
      if (!cart.cost) cart.cost = {}
      cart.cost.subtotalAmount = {
        ...(cart.cost.subtotalAmount ?? { currencyCode: cart?.cost?.totalAmount?.currencyCode ?? "USD" }),
        amount: String(subtotal.toFixed(2)),
      }
      cart.cost.totalAmount = {
        ...(cart.cost.totalAmount ?? { currencyCode: cart?.cost?.totalAmount?.currencyCode ?? "USD" }),
        amount: String(Math.max(0, subtotal).toFixed(2)),
      }
      cart.totalQuantity = Math.max(0, Number(cart.totalQuantity ?? 0) - qty)
      // write back nodes
      if (cart.lines?.nodes) cart.lines.nodes = nodes
      qc.setQueryData(key, cart)
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSuccess: () => {
      if (cartId) qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}

export function useUpdateDiscountCodes() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (codes: string[] | undefined) => {
      if (!cartId) throw new Error("Cart not initialized")
      const res = await updateDiscountCodes(cartId, codes, locale)
      return res.cartDiscountCodesUpdate?.cart ?? null
    },
    onSuccess: () => {
      if (cartId) qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}

// Batch-sync cart changes to reduce API calls.
// Accepts arrays of updates and removals and applies them in a single mutation cycle.
export function useSyncCartChanges() {
  const locale = currentLocale()
  const { cartId } = useCartId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { updates: { id: string; quantity: number }[]; removes: string[] }) => {
      if (!cartId) throw new Error("Cart not initialized")
      // Apply removes first to avoid conflicts
      if (payload.removes.length) {
        await removeLines(cartId, payload.removes, locale)
      }
      if (payload.updates.length) {
        await updateLines(
          cartId,
          payload.updates.map((u) => ({ id: u.id, quantity: u.quantity })),
          locale,
        )
      }
      return true
    },
    onMutate: async (payload) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<any>(key)
      if (!prev) return { prev }
      const cart = JSON.parse(JSON.stringify(prev))
      const nodes: any[] = cart?.lines?.nodes ?? []
      // Removes
      if (payload.removes?.length) {
        for (const id of payload.removes) {
          const idx = nodes.findIndex((n) => n.id === id)
          if (idx !== -1) nodes.splice(idx, 1)
        }
      }
      // Updates
      if (payload.updates?.length) {
        for (const u of payload.updates) {
          const line = nodes.find((n) => n.id === u.id)
          if (line) line.quantity = u.quantity
        }
      }
      // Recompute costs optimistically based on variant unit price
      const subtotal = nodes.reduce(
        (sum, l) => sum + Number(l?.merchandise?.price?.amount ?? 0) * Number(l?.quantity ?? 1),
        0,
      )
      if (!cart.cost) cart.cost = {}
      const currency = cart?.cost?.totalAmount?.currencyCode ?? cart?.cost?.subtotalAmount?.currencyCode ?? "USD"
      cart.cost.subtotalAmount = { currencyCode: currency, amount: String(subtotal.toFixed(2)) }
      cart.cost.totalAmount = { currencyCode: currency, amount: String(Math.max(0, subtotal).toFixed(2)) }
      cart.totalQuantity = nodes.reduce((n: number, l: any) => n + Number(l?.quantity ?? 0), 0)
      if (cart.lines?.nodes) cart.lines.nodes = nodes
      qc.setQueryData(key, cart)
      return { prev }
    },
    onError: (_e, _p, ctx) => {
      if (!cartId) return
      const key = qk.cart(cartId) as any
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSuccess: () => {
      if (cartId) qc.invalidateQueries({ queryKey: qk.cart(cartId) as any })
    },
  })
}
