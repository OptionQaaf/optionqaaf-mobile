import { create } from "zustand"
import { PopupPayload } from "@/types/popup"

type PopupState = {
  popup: PopupPayload | null
  setPopup: (popup: PopupPayload | null) => void
  clearPopup: () => void
}

export const usePopupStore = create<PopupState>((set) => ({
  popup: null,
  setPopup: (popup) => set({ popup }),
  clearPopup: () => set({ popup: null }),
}))
