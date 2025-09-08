import { kv } from "@/lib/storage/mmkv"
import { create } from "zustand"

export type LanguageCode = "EN" | "AR"
export type CountryCode = "SA" | "AE" | "KW" | "QA" | "BH" | "OM"
export type CurrencyCode = "SAR" | "AED" | "KWD" | "QAR" | "BHD" | "OMR"

export type PrefsState = {
  language: string
  country: string
  currency: string
  setPrefs: (p: Partial<PrefsState>) => void
}

const KEY = "prefs"

const initial: PrefsState = (() => {
  const raw = kv.get(KEY)
  if (raw)
    try {
      return { ...JSON.parse(raw), setPrefs: () => {} } as any
    } catch {}
  return { language: "EN", country: "SA", currency: "SAR", setPrefs: () => {} } as any
})()

export const usePrefs = create<PrefsState>((set, get) => ({
  ...initial,
  setPrefs: (p) => {
    const next = { ...get(), ...p }
    set(next)
    kv.set(KEY, JSON.stringify({ language: next.language, country: next.country, currency: next.currency }))
  },
}))

export function currentLocale() {
  const { language, country, currency } = usePrefs.getState()
  return { language, country, currency }
}
