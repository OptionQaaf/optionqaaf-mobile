import { kv } from "@/lib/storage/mmkv"
import { create } from "zustand"

export type NotificationSettings = {
  pushEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
  expoPushToken: string | null
}

type NotificationStore = NotificationSettings & {
  setPreferences: (prefs: Partial<NotificationSettings>) => void
  setPushPreference: (enabled: boolean, token: string | null) => void
}

const KEY = "notification-settings"

const defaultSettings: NotificationSettings = {
  pushEnabled: false,
  emailEnabled: true,
  smsEnabled: false,
  expoPushToken: null,
}

const loadSettings = (): NotificationSettings => {
  const raw = kv.get(KEY)
  if (!raw) return { ...defaultSettings }
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>
    return {
      pushEnabled: parsed.pushEnabled ?? defaultSettings.pushEnabled,
      emailEnabled: parsed.emailEnabled ?? defaultSettings.emailEnabled,
      smsEnabled: parsed.smsEnabled ?? defaultSettings.smsEnabled,
      expoPushToken: parsed.expoPushToken ?? defaultSettings.expoPushToken,
    }
  } catch {
    return { ...defaultSettings }
  }
}

const persist = (settings: NotificationSettings) => {
  kv.set(
    KEY,
    JSON.stringify({
      pushEnabled: settings.pushEnabled,
      emailEnabled: settings.emailEnabled,
      smsEnabled: settings.smsEnabled,
      expoPushToken: settings.expoPushToken,
    }),
  )
}

export const useNotificationSettings = create<NotificationStore>((set, get) => ({
  ...loadSettings(),
  setPreferences: (prefs) => {
    const current = get()
    const next: NotificationSettings = {
      pushEnabled: prefs.pushEnabled ?? current.pushEnabled,
      emailEnabled: prefs.emailEnabled ?? current.emailEnabled,
      smsEnabled: prefs.smsEnabled ?? current.smsEnabled,
      expoPushToken: prefs.expoPushToken ?? current.expoPushToken,
    }
    set({ ...current, ...next })
    persist(next)
  },
  setPushPreference: (enabled, token) => {
    const current = get()
    const next: NotificationSettings = {
      pushEnabled: enabled,
      emailEnabled: current.emailEnabled,
      smsEnabled: current.smsEnabled,
      expoPushToken: token,
    }
    set({ ...current, ...next })
    persist(next)
  },
}))

export function getNotificationSettings(): NotificationSettings {
  const { pushEnabled, emailEnabled, smsEnabled, expoPushToken } = useNotificationSettings.getState()
  return { pushEnabled, emailEnabled, smsEnabled, expoPushToken }
}
