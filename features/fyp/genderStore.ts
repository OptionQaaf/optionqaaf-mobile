import { create } from "zustand"
import {
  clearFypSettings,
  DEFAULT_FYP_SETTINGS,
  readFypSettings,
  type Gender,
  writeFypSettings,
} from "@/features/fyp/fypStorage"

type FypGenderState = {
  gender: Gender
  hasHydrated: boolean
  forceShowPopup: boolean
  setGender: (gender: Gender) => void
  hydrate: () => Promise<void>
  loadFromStorage: () => void
  reset: () => void
  triggerPopup: () => void
  clearPopupTrigger: () => void
}

export const useFypGenderStore = create<FypGenderState>((set) => ({
  gender: DEFAULT_FYP_SETTINGS.gender,
  hasHydrated: false,
  forceShowPopup: false,
  setGender: (gender) => {
    const next = { gender, updatedAt: Date.now() }
    void writeFypSettings(next).catch(() => {})
    set({ gender, hasHydrated: true, forceShowPopup: false })
  },
  hydrate: async () => {
    const saved = await readFypSettings()
    set({ gender: saved.gender, hasHydrated: true })
  },
  loadFromStorage: () => {
    void (async () => {
      const saved = await readFypSettings()
      set({ gender: saved.gender, hasHydrated: true })
    })()
  },
  reset: () => {
    void clearFypSettings().catch(() => {})
    set({ gender: "unknown", hasHydrated: true, forceShowPopup: false })
  },
  triggerPopup: () => set({ forceShowPopup: true }),
  clearPopupTrigger: () => set({ forceShowPopup: false }),
}))
