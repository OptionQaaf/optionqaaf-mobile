import { create } from "zustand"
import {
  clearFypTrackingState,
  type ProductAffinity,
  readFypTrackingStateAsync,
  type FypTrackingState,
  writeFypTrackingState,
} from "@/features/fyp/fypStorage"

export const MAX_PRODUCTS_TRACKED = 200
const HALF_LIFE_HOURS = 72
const HOUR_MS = 60 * 60 * 1000

export type ProductAffinityWithComputedScore = ProductAffinity & {
  weightedScore: number
}

export type DebugTrackingSnapshot = {
  totalProducts: number
  totalTrackedEvents: number
  last10Interactions: {
    handle: string
    at: number
  }[]
  top10: {
    handle: string
    rawScore: number
    weightedScore: number
  }[]
}

type FypTrackingStore = {
  products: Record<string, ProductAffinity>
  recordView: (handle: string) => void
  recordAddToCart: (handle: string) => void
  getWeightedProducts: () => ProductAffinityWithComputedScore[]
  getDebugTrackingSnapshot: () => DebugTrackingSnapshot
  pruneIfNeeded: () => void
  loadFromStorage: () => Promise<void>
  reset: () => void
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return value
}

function computeWeightedScore(affinity: ProductAffinity, now: number): number {
  const rawScore = clampNonNegative(safeNumber(affinity.rawScore))
  const lastInteractionAt = clampNonNegative(safeNumber(affinity.lastInteractionAt))
  const elapsedMs = Math.max(0, now - lastInteractionAt)
  const hoursSinceLastInteraction = elapsedMs / HOUR_MS
  const decayFactor = Math.pow(0.5, hoursSinceLastInteraction / HALF_LIFE_HOURS)

  let recencyMultiplier = 1
  if (hoursSinceLastInteraction < 6) recencyMultiplier = 1.25
  else if (hoursSinceLastInteraction < 24) recencyMultiplier = 1.1

  return clampNonNegative(rawScore * decayFactor * recencyMultiplier)
}

function normalizeStoredAffinity(key: string, value: ProductAffinity, now: number): ProductAffinity | null {
  const affinity = value as Partial<ProductAffinity>
  const handle = (typeof affinity.handle === "string" ? affinity.handle : key).trim().toLowerCase()
  if (!handle) return null

  const rawScore = clampNonNegative(safeNumber(affinity.rawScore, 0))
  const lastInteractionAt = clampNonNegative(safeNumber(affinity.lastInteractionAt, 0))
  const firstFromStored = clampNonNegative(safeNumber(affinity.firstInteractionAt, 0))
  const firstInteractionAt = firstFromStored > 0 ? firstFromStored : lastInteractionAt

  return {
    handle,
    rawScore,
    viewCount: clampNonNegative(safeNumber(affinity.viewCount, 0)),
    addToCartCount: clampNonNegative(safeNumber(affinity.addToCartCount, 0)),
    firstInteractionAt: Math.min(firstInteractionAt || lastInteractionAt || now, lastInteractionAt || now),
    lastInteractionAt,
  }
}

function pruneProducts(products: Record<string, ProductAffinity>): Record<string, ProductAffinity> {
  const entries = Object.entries(products)
  if (entries.length <= MAX_PRODUCTS_TRACKED) return products

  const now = Date.now()
  const sorted = entries.sort(([, a], [, b]) => {
    const weightedA = computeWeightedScore(a, now)
    const weightedB = computeWeightedScore(b, now)
    if (weightedA !== weightedB) return weightedB - weightedA
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
  eventType: "view" | "add_to_cart",
): Record<string, ProductAffinity> {
  const key = handle.trim().toLowerCase()
  if (!key) return products
  const now = Date.now()
  const existing = products[key]
  const nextRawScore = clampNonNegative(safeNumber(existing?.rawScore, 0) + increment)
  const nextViewCount = clampNonNegative(safeNumber(existing?.viewCount, 0) + (eventType === "view" ? 1 : 0))
  const nextAddToCartCount = clampNonNegative(
    safeNumber(existing?.addToCartCount, 0) + (eventType === "add_to_cart" ? 1 : 0),
  )
  const previousFirstInteraction = clampNonNegative(safeNumber(existing?.firstInteractionAt, 0))

  return {
    ...products,
    [key]: {
      handle: key,
      rawScore: nextRawScore,
      viewCount: nextViewCount,
      addToCartCount: nextAddToCartCount,
      firstInteractionAt: previousFirstInteraction > 0 ? previousFirstInteraction : now,
      lastInteractionAt: now,
    },
  }
}

export const useFypTrackingStore = create<FypTrackingStore>((set, get) => ({
  products: {} as Record<string, ProductAffinity>,
  recordView: (handle) => {
    set((state) => {
      const products = pruneProducts(recordInteraction(state.products, handle, 1, "view"))
      if (__DEV__) {
        const normalized = handle.trim().toLowerCase()
        const entry = normalized ? products[normalized] : null
        console.debug("[fyp:track] view", {
          handle: normalized || null,
          totalProducts: Object.keys(products).length,
          rawScore: entry?.rawScore ?? null,
          viewCount: entry?.viewCount ?? null,
          addToCartCount: entry?.addToCartCount ?? null,
        })
      }
      persist({ products, updatedAt: Date.now() })
      return { products }
    })
  },
  recordAddToCart: (handle) => {
    set((state) => {
      const products = pruneProducts(recordInteraction(state.products, handle, 4, "add_to_cart"))
      if (__DEV__) {
        const normalized = handle.trim().toLowerCase()
        const entry = normalized ? products[normalized] : null
        console.debug("[fyp:track] add_to_cart", {
          handle: normalized || null,
          totalProducts: Object.keys(products).length,
          rawScore: entry?.rawScore ?? null,
          viewCount: entry?.viewCount ?? null,
          addToCartCount: entry?.addToCartCount ?? null,
        })
      }
      persist({ products, updatedAt: Date.now() })
      return { products }
    })
  },
  getWeightedProducts: () => {
    const now = Date.now()
    const products = Object.values(get().products).map((entry) => ({
      ...entry,
      weightedScore: computeWeightedScore(entry, now),
    }))

    products.sort((a, b) => {
      if (a.weightedScore !== b.weightedScore) return b.weightedScore - a.weightedScore
      if (a.lastInteractionAt !== b.lastInteractionAt) return b.lastInteractionAt - a.lastInteractionAt
      return a.handle.localeCompare(b.handle)
    })

    return products
  },
  getDebugTrackingSnapshot: () => {
    const weighted = get().getWeightedProducts()
    const last10Interactions = Object.values(get().products)
      .slice()
      .sort((a, b) => b.lastInteractionAt - a.lastInteractionAt)
      .slice(0, 10)
      .map((entry) => ({ handle: entry.handle, at: entry.lastInteractionAt }))

    return {
      totalProducts: weighted.length,
      totalTrackedEvents: Object.values(get().products).reduce(
        (sum, entry) => sum + entry.viewCount + entry.addToCartCount,
        0,
      ),
      last10Interactions,
      top10: weighted.slice(0, 10).map((entry) => ({
        handle: entry.handle,
        rawScore: entry.rawScore,
        weightedScore: entry.weightedScore,
      })),
    }
  },
  pruneIfNeeded: () => {
    const current = get().products
    const products = pruneProducts(current)
    if (products === current) return
    persist({ products, updatedAt: Date.now() })
    set({ products })
  },
  loadFromStorage: async () => {
    const saved = await readFypTrackingStateAsync()
    const now = Date.now()
    const migratedProducts: Record<string, ProductAffinity> = {}

    for (const [key, value] of Object.entries(saved.products ?? {})) {
      const migrated = normalizeStoredAffinity(key, value, now)
      if (!migrated) continue
      migratedProducts[migrated.handle] = migrated
    }

    const products = pruneProducts(migratedProducts)
    if (__DEV__) {
      console.debug("[fyp:track] hydrate", {
        persistedProducts: Object.keys(saved.products ?? {}).length,
        hydratedProducts: Object.keys(products).length,
      })
    }
    set({ products })
    persist({ products, updatedAt: Date.now() })
  },
  reset: () => {
    clearFypTrackingState()
    set({ products: {} })
  },
}))
