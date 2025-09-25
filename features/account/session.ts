import { kv } from "@/lib/storage/mmkv"
import { create } from "zustand"

export type StoredCustomerSession = {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  idToken?: string
  scope?: string
}

const STORAGE_KEY = "customer:session"

function readInitialSession(): StoredCustomerSession {
  const raw = kv.get(STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") {
      const session: StoredCustomerSession = {
        accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : undefined,
        refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
        expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined,
        idToken: typeof parsed.idToken === "string" ? parsed.idToken : undefined,
        scope: typeof parsed.scope === "string" ? parsed.scope : undefined,
      }
      return session
    }
  } catch (err) {
    if (__DEV__) {
      console.warn("[auth] failed to parse stored customer session", err)
    }
  }
  return {}
}

function persistSession(session: StoredCustomerSession) {
  const data: StoredCustomerSession = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    idToken: session.idToken,
    scope: session.scope,
  }

  if (!data.accessToken && !data.refreshToken) {
    kv.del(STORAGE_KEY)
    return
  }

  kv.set(STORAGE_KEY, JSON.stringify(data))
}

export type CustomerSessionState = StoredCustomerSession & {
  isRefreshing: boolean
  setSession: (session: StoredCustomerSession) => void
  patchSession: (patch: Partial<StoredCustomerSession>) => void
  clear: () => void
  markRefreshing: (value: boolean) => void
}

const initial = readInitialSession()

export const useCustomerSession = create<CustomerSessionState>((set, get) => ({
  ...initial,
  isRefreshing: false,
  setSession: (session) => {
    persistSession(session)
    set({ ...session, isRefreshing: false })
  },
  patchSession: (patch) => {
    const next = { ...get(), ...patch }
    persistSession(next)
    set(patch as any)
  },
  clear: () => {
    kv.del(STORAGE_KEY)
    set({
      accessToken: undefined,
      refreshToken: undefined,
      expiresAt: undefined,
      idToken: undefined,
      scope: undefined,
      isRefreshing: false,
    })
  },
  markRefreshing: (value) => set({ isRefreshing: value }),
}))

export function isCustomerAuthenticated() {
  const { accessToken } = useCustomerSession.getState()
  return !!accessToken
}

export function resetCustomerSession() {
  useCustomerSession.getState().clear()
}
