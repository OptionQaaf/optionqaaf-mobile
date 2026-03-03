import { kv as asyncKv } from "@/lib/storage/storage"
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

function parseSettings(raw: string | null | undefined): PersonalizationSettings {
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

function serializeSettings(settings: PersonalizationSettings): string {
  return JSON.stringify({
    gender: settings.gender,
    birthDate: settings.birthDate,
  })
}

function loadSettings(): PersonalizationSettings {
  const raw = kv.get(KEY)
  return parseSettings(raw)
}

function persist(settings: PersonalizationSettings) {
  const payload = serializeSettings(settings)
  kv.set(KEY, payload)
  void asyncKv.set(KEY, payload).catch((error: unknown) => {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[personalization] failed async mirror persist", error)
    }
  })
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

async function hydratePersonalizationFromAsyncStorage() {
  try {
    const raw = await asyncKv.get(KEY)
    const next = parseSettings(raw)
    if (!next.gender && !next.birthDate) return

    const current = usePersonalization.getState()
    if (current.gender || current.birthDate) return

    usePersonalization.setState(next)
    kv.set(KEY, serializeSettings(next))
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[personalization] failed async hydration", error)
    }
  }
}

void hydratePersonalizationFromAsyncStorage()
