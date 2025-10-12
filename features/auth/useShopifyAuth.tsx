// src/features/auth/useShopifyAuth.tsx
import { exchangeToken, getValidAccessToken, logoutShopify, startLogin } from "@/lib/shopify/customer/auth"
import { fetchOpenIdConfig } from "@/lib/shopify/customer/discovery"
import { SHOPIFY_CUSTOMER_CLIENT_ID as CLIENT_ID, SHOPIFY_CUSTOMER_REDIRECT_URI as REDIRECT } from "@/lib/shopify/env"
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
    const t = await getValidAccessToken()
    if (t) {
      setToken(t)
      return true
    }

    try {
      const { authorization_endpoint } = await fetchOpenIdConfig()
      const u = new URL(authorization_endpoint)
      u.searchParams.set("scope", "openid email customer-account-api:full")
      u.searchParams.set("client_id", CLIENT_ID)
      u.searchParams.set("response_type", "code")
      u.searchParams.set("redirect_uri", REDIRECT)
      u.searchParams.set("prompt", "none")

      const res = await fetch(u.toString(), { redirect: "manual" })
      const location = res.headers.get("location") || ""
      if (location.includes("login_required")) return false
      const codeMatch = location.match(/[?&]code=([^&]+)/)
      if (codeMatch?.[1]) {
        await exchangeToken(decodeURIComponent(codeMatch[1]))
        const token = await getValidAccessToken()
        setToken(token)
        return !!token
      }
    } catch {
      /* ignore */
    }
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
          const t = await getValidAccessToken()
          if (t) {
            setToken(t)
            return
          }
          await silentSignIn()
        } catch {
          // swallow; silentSignIn already handles failure logging via toast elsewhere if needed
        }
      }
    })
    return () => sub.remove()
  }, [])

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
