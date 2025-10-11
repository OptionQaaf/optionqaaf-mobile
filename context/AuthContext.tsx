import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
  loginWithOTP as startHostedLogin,
  getSession as loadStoredSession,
  logout as performLogout,
} from "@/lib/customerAuth"
import { getCachedSession } from "@/lib/customerAuth/session"
import { getMe, CustomerApiError, InvalidTokenError, ThrottledError, PermissionError } from "@/lib/customerApi"
import type { Customer } from "@/lib/customerApi"
import type { CustomerSession } from "@/lib/customerAuth/session"

function resolveDeviceLocale(): string | undefined {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    return typeof locale === "string" && locale.length > 0 ? locale : undefined
  } catch {
    return undefined
  }
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated"

type AuthContextValue = {
  status: AuthStatus
  session: CustomerSession | null
  customer: Customer | null
  isLoading: boolean
  isFetchingCustomer: boolean
  error?: string
  loginWithOTP: () => Promise<void>
  logout: () => Promise<void>
  reloadCustomer: () => Promise<void>
  setCustomer: (customer: Customer | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(getCachedSession())
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingCustomer, setIsFetchingCustomer] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const fetchCustomer = useCallback(async () => {
    setIsFetchingCustomer(true)
    try {
      const data = await getMe()
      setCustomer(data)
      setError(undefined)
    } catch (err) {
      if (err instanceof InvalidTokenError) {
        await performLogout()
        setSession(null)
        setCustomer(null)
      } else if (err instanceof ThrottledError) {
        setError("Shopify is throttling account requests. Please try again in a moment.")
      } else if (err instanceof PermissionError) {
        setError("Your account does not have permission to access this data.")
      } else if (err instanceof CustomerApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Unable to load account data")
      }
    } finally {
      setIsFetchingCustomer(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stored = await loadStoredSession()
        if (cancelled) return
        setSession(stored)
        if (stored) {
          await fetchCustomer()
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to restore session")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchCustomer])

  const loginWithOTP = useCallback(async () => {
    setError(undefined)
    setIsFetchingCustomer(true)
    try {
      const locale = resolveDeviceLocale()
      const nextSession = await startHostedLogin(locale ? { locale } : undefined)
      setSession(nextSession)
      await fetchCustomer()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
      throw err
    } finally {
      setIsFetchingCustomer(false)
      setIsLoading(false)
    }
  }, [fetchCustomer])

  const logout = useCallback(async () => {
    setError(undefined)
    await performLogout()
    setSession(null)
    setCustomer(null)
  }, [])

  const reloadCustomer = useCallback(async () => {
    await fetchCustomer()
  }, [fetchCustomer])

  const status: AuthStatus = useMemo(() => {
    if (isLoading) return "loading"
    return session ? "authenticated" : "unauthenticated"
  }, [isLoading, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      customer,
      isLoading,
      isFetchingCustomer,
      error,
      loginWithOTP,
      logout,
      reloadCustomer,
      setCustomer,
    }),
    [status, session, customer, isLoading, isFetchingCustomer, error, loginWithOTP, logout, reloadCustomer],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("AuthContext not found")
  return ctx
}
