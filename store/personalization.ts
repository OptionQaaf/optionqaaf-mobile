import { kv } from "@/lib/storage/mmkv"
import { isGenderChoice, type GenderChoice } from "@/lib/personalization/gender"
import { create } from "zustand"

export type PersonalizationSettings = {
  gender: GenderChoice | null
}

type PersonalizationStore = PersonalizationSettings & {
  setGender: (gender: GenderChoice | null) => void
}

const KEY = "personalization-settings"

const defaultSettings: PersonalizationSettings = {
  gender: null,
}

function loadSettings(): PersonalizationSettings {
  const raw = kv.get(KEY)
  if (!raw) return { ...defaultSettings }

  try {
    const parsed = JSON.parse(raw) as Partial<PersonalizationSettings>
    return {
      gender: isGenderChoice(parsed.gender) ? parsed.gender : null,
    }
  } catch {
    return { ...defaultSettings }
  }
}

function persist(settings: PersonalizationSettings) {
  kv.set(
    KEY,
    JSON.stringify({
      gender: settings.gender,
    }),
  )
}

export const usePersonalization = create<PersonalizationStore>((set) => ({
  ...loadSettings(),
  setGender: (gender) => {
    const next: PersonalizationSettings = {
      gender,
    }
    set(next)
    persist(next)
  },
}))

export function getPersonalizationSettings(): PersonalizationSettings {
  const { gender } = usePersonalization.getState()
  return { gender }
}
