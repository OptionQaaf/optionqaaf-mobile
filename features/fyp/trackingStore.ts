import { create } from "zustand"
import {
  clearFypTrackingState,
  DEFAULT_FYP_TRACKING_STATE,
  readFypTrackingState,
  type FypTrackingState,
  type ProductAffinity,
  writeFypTrackingState,
} from "@/features/fyp/fypStorage"

export const MAX_PRODUCTS_TRACKED = 200

type FypTrackingStore = {
  products: Record<string, ProductAffinity>
  recordView: (handle: string) => void
  recordAddToCart: (handle: string) => void
  pruneIfNeeded: () => void
  loadFromStorage: () => void
  reset: () => void
}

function pruneProducts(products: Record<string, ProductAffinity>): Record<string, ProductAffinity> {
  const entries = Object.entries(products)
  if (entries.length <= MAX_PRODUCTS_TRACKED) return products

  const sorted = entries.sort(([, a], [, b]) => {
    if (a.score !== b.score) return b.score - a.score
    if (a.lastInteractionAt !== b.lastInteractionAt) return b.lastInteractionAt - a.lastInteractionAt
    return a.handle.localeCompare(b.handle)
  })

  return Object.fromEntries(sorted.slice(0, MAX_PRODUCTS_TRACKED))
}

function persist(state: FypTrackingState): void {
  writeFypTrackingState(state)
}

function recordInteraction(
  products: Record<string, ProductAffinity>,
  handle: string,
  increment: number,
): Record<string, ProductAffinity> {
  const key = handle.trim()
  if (!key) return products
  const now = Date.now()
  const existing = products[key]
  return {
    ...products,
    [key]: {
      handle: key,
      score: (existing?.score ?? 0) + increment,
      lastInteractionAt: now,
    },
  }
}

export const useFypTrackingStore = create<FypTrackingStore>((set, get) => ({
  products: DEFAULT_FYP_TRACKING_STATE.products,
  recordView: (handle) => {
    set((state) => {
      const products = pruneProducts(recordInteraction(state.products, handle, 1))
      persist({ products, updatedAt: Date.now() })
      return { products }
    })
  },
  recordAddToCart: (handle) => {
    set((state) => {
      const products = pruneProducts(recordInteraction(state.products, handle, 3))
      persist({ products, updatedAt: Date.now() })
      return { products }
    })
  },
  pruneIfNeeded: () => {
    const current = get().products
    const products = pruneProducts(current)
    if (products === current) return
    persist({ products, updatedAt: Date.now() })
    set({ products })
  },
  loadFromStorage: () => {
    const saved = readFypTrackingState()
    const products = pruneProducts(saved.products)
    set({ products })
    persist({ products, updatedAt: Date.now() })
  },
  reset: () => {
    clearFypTrackingState()
    set({ products: {} })
  },
}))
