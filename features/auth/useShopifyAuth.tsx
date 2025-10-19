// src/features/auth/useShopifyAuth.tsx
import { getValidAccessToken, logoutShopify, startLogin } from "@/lib/shopify/customer/auth"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { AppState } from "react-native"
import { useCartId } from "@/store/cartId"

// Minimal types
type Ctx = {
  isAuthenticated: boolean
  token?: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
  silentSignIn: () => Promise<boolean>
  getToken: () => Promise<string | null>
  initializing: boolean
}

const AuthCtx = createContext<Ctx | null>(null)

export function ShopifyAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const isAuthenticated = !!token

  const login = useCallback(async () => {
    await startLogin()
    const t = await getValidAccessToken()
    setToken(t)
  }, [])

  const logout = useCallback(async () => {
    await logoutShopify()
    setToken(null)
    useCartId.getState().setCartId(null)
  }, [])

  // Silent sign-in using prompt=none (no UI). Returns true if session found.
  const silentSignIn = useCallback(async () => {
    const refreshedToken = await getValidAccessToken()
    if (refreshedToken) {
      setToken(refreshedToken)
      return true
    }
    setToken(null)
    return false
  }, [])

  const getToken = useCallback(async () => {
    const t = await getValidAccessToken()
    if (t !== token) setToken(t)
    return t
  }, [token])

  // Refresh token when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active") {
        try {
          await silentSignIn()
        } catch {
          // Network or unexpected failure — force logout state so UI can prompt
          setToken(null)
        }
      }
    })
    return () => sub.remove()
  }, [silentSignIn])

  // initial check on mount
  useEffect(() => {
    let mounted = true
    silentSignIn()
      .catch(() => false)
      .finally(() => {
        if (mounted) setInitializing(false)
      })
    return () => {
      mounted = false
    }
  }, [silentSignIn])

  const value = useMemo<Ctx>(
    () => ({
      isAuthenticated,
      token,
      login,
      logout,
      silentSignIn,
      getToken,
      initializing,
    }),
    [isAuthenticated, token, login, logout, silentSignIn, getToken, initializing],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useShopifyAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error("useShopifyAuth must be used inside <ShopifyAuthProvider>")
  return ctx
}
