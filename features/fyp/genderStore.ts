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
  forceShowPopup: boolean
  setGender: (gender: Gender) => void
  loadFromStorage: () => void
  reset: () => void
  triggerPopup: () => void
  clearPopupTrigger: () => void
}

export const useFypGenderStore = create<FypGenderState>((set) => ({
  gender: DEFAULT_FYP_SETTINGS.gender,
  forceShowPopup: false,
  setGender: (gender) => {
    const next = { gender, updatedAt: Date.now() }
    writeFypSettings(next)
    set({ gender, forceShowPopup: false })
  },
  loadFromStorage: () => {
    const saved = readFypSettings()
    set({ gender: saved.gender })
  },
  reset: () => {
    clearFypSettings()
    set({ gender: "unknown", forceShowPopup: false })
  },
  triggerPopup: () => set({ forceShowPopup: true }),
  clearPopupTrigger: () => set({ forceShowPopup: false }),
}))
