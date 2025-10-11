// src/features/auth/useShopifyAuth.tsx
import { getValidAccessToken, logoutShopify, startLogin } from "@/lib/shopify/customer/auth"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { AppState } from "react-native"

// Minimal types
type Ctx = {
  isAuthenticated: boolean
  token?: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
  silentSignIn: () => Promise<boolean>
  getToken: () => Promise<string | null>
}

const AuthCtx = createContext<Ctx | null>(null)

export function ShopifyAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const isAuthenticated = !!token

  const login = useCallback(async () => {
    await startLogin()
    const next = await getValidAccessToken()
    setToken(next)
  }, [])

  const logout = useCallback(async () => {
    await logoutShopify()
    setToken(null)
  }, [])

  // Silent sign-in via stored tokens. Returns true if session found.
  const silentSignIn = useCallback(async () => {
    const next = await getValidAccessToken()
    setToken(next)
    return Boolean(next)
  }, [])

  const getToken = useCallback(async () => {
    const t = await getValidAccessToken()
    if (t !== token) setToken(t)
    return t
  }, [token])

  // Refresh token when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        silentSignIn().catch(() => {})
      }
    })
    return () => sub.remove()
  }, [silentSignIn])

  // initial check on mount
  useEffect(() => {
    silentSignIn().catch(() => {})
  }, [silentSignIn])

  const value = useMemo<Ctx>(
    () => ({
      isAuthenticated,
      token,
      login,
      logout,
      silentSignIn,
      getToken,
    }),
    [isAuthenticated, token, login, logout, silentSignIn, getToken],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useShopifyAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error("useShopifyAuth must be used inside <ShopifyAuthProvider>")
  return ctx
}
