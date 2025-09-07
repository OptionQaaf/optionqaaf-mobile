import { kv } from "@/lib/storage/storage"
import { create } from "zustand"

type CartIdState = { cartId: string | null; setCartId: (id: string | null) => void; hydrated: boolean }

export const useCartId = create<CartIdState>((set, get) => ({
  cartId: null,
  hydrated: false,
  setCartId: (id) => {
    if (id) kv.set("cartId", id)
    else kv.del("cartId")
    set({ cartId: id })
  },
}))

export async function hydrateCartId() {
  const saved = await kv.get("cartId")
  useCartId.setState({ cartId: saved, hydrated: true })
}
