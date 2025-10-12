import { kv } from "@/lib/storage/storage"
import { create } from "zustand"

export type WishlistItem = {
  productId: string
  handle: string
  title: string
  vendor?: string | null
  price?: { amount: number; currencyCode: string } | null
  imageUrl?: string | null
  variantTitle?: string | null
}

type WishlistState = {
  items: WishlistItem[]
  add: (item: WishlistItem) => void
  remove: (productId: string) => void
  toggle: (item: WishlistItem) => void
  has: (productId: string) => boolean
  clear: () => void
}

const KEY = "wishlist.items"

async function loadInitial(): Promise<WishlistItem[]> {
  try {
    const raw = await kv.get(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is WishlistItem => typeof item?.productId === "string")
    }
  } catch (err) {
    if (__DEV__) console.warn("[wishlist] failed to load", err)
  }
  return []
}

function persist(items: WishlistItem[]) {
  kv.set(KEY, JSON.stringify(items)).catch((err: unknown) => {
    if (__DEV__) console.warn("[wishlist] failed to persist", err)
  })
}

export const useWishlist = create<WishlistState>((set, get) => {
  loadInitial().then((items) => {
    set({ items })
  })

  return {
    items: [],
    add: (item) => {
      if (!item.productId) return
      set((state) => {
        if (state.items.some((i) => i.productId === item.productId)) return state
        const items = [item, ...state.items]
        persist(items)
        return { items }
      })
    },
    remove: (productId) => {
      set((state) => {
        const items = state.items.filter((i) => i.productId !== productId)
        persist(items)
        return { items }
      })
    },
    toggle: (item) => {
      const exists = get().items.some((i) => i.productId === item.productId)
      if (exists) get().remove(item.productId)
      else get().add(item)
    },
    has: (productId) => get().items.some((i) => i.productId === productId),
    clear: () => {
      persist([])
      set({ items: [] })
    },
  }
})
