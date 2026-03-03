import { kv } from "@/lib/storage/mmkv"
import { create } from "zustand"

type AdminViewState = {
  viewAsNonAdmin: boolean
  setViewAsNonAdmin: (next: boolean) => void
}

const KEY = "admin-view"

function loadInitialViewAsNonAdmin(): boolean {
  try {
    const raw = kv.get(KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { viewAsNonAdmin?: unknown }
    return parsed.viewAsNonAdmin === true
  } catch {
    return false
  }
}

function persist(viewAsNonAdmin: boolean) {
  kv.set(KEY, JSON.stringify({ viewAsNonAdmin }))
}

export const useAdminView = create<AdminViewState>((set) => ({
  viewAsNonAdmin: loadInitialViewAsNonAdmin(),
  setViewAsNonAdmin: (next) => {
    set({ viewAsNonAdmin: next })
    persist(next)
  },
}))
