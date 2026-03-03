import { kv } from "@/lib/storage/mmkv"
import { isBirthDateValue, type BirthDateValue } from "@/lib/personalization/birthDate"
import { isGenderChoice, type GenderChoice } from "@/lib/personalization/gender"
import { create } from "zustand"

export type PersonalizationSettings = {
  gender: GenderChoice | null
  birthDate: BirthDateValue | null
}

type PersonalizationStore = PersonalizationSettings & {
  setGender: (gender: GenderChoice | null) => void
  setBirthDate: (birthDate: BirthDateValue | null) => void
}

const KEY = "personalization-settings"

const defaultSettings: PersonalizationSettings = {
  gender: null,
  birthDate: null,
}

function loadSettings(): PersonalizationSettings {
  const raw = kv.get(KEY)
  if (!raw) return { ...defaultSettings }

  try {
    const parsed = JSON.parse(raw) as Partial<PersonalizationSettings>
    return {
      gender: isGenderChoice(parsed.gender) ? parsed.gender : null,
      birthDate: isBirthDateValue(parsed.birthDate) ? parsed.birthDate : null,
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
      birthDate: settings.birthDate,
    }),
  )
}

export const usePersonalization = create<PersonalizationStore>((set, get) => ({
  ...loadSettings(),
  setGender: (gender) => {
    const current = get()
    const next: PersonalizationSettings = {
      gender,
      birthDate: current.birthDate,
    }
    set(next)
    persist(next)
  },
  setBirthDate: (birthDate) => {
    const current = get()
    const next: PersonalizationSettings = {
      gender: current.gender,
      birthDate,
    }
    set(next)
    persist(next)
  },
}))

export function getPersonalizationSettings(): PersonalizationSettings {
  const { gender, birthDate } = usePersonalization.getState()
  return { gender, birthDate }
}
