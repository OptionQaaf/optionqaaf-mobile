import type { ForYouCandidate } from "@/features/for-you/profile"
import { create } from "zustand"

type ForYouFeedState = {
  items: ForYouCandidate[]
  setItems: (items: ForYouCandidate[]) => void
  clear: () => void
}

export const useForYouFeedStore = create<ForYouFeedState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  clear: () => set({ items: [] }),
}))
