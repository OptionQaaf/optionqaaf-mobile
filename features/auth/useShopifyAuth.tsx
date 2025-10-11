// src/features/auth/useShopifyAuth.tsx
import { getValidAccessToken, logoutShopify, startLogin } from "@/lib/shopify/customer/auth"
import { fetchOpenIdConfig } from "@/lib/shopify/customer/discovery"
import { SHOPIFY_CUSTOMER_CLIENT_ID as CLIENT_ID, SHOPIFY_CUSTOMER_REDIRECT_URI as REDIRECT } from "@/lib/shopify/env"
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
    const t = await getValidAccessToken()
    setToken(t)
  }, [])

  const logout = useCallback(async () => {
    await logoutShopify()
    setToken(null)
  }, [])

  // Silent sign-in using prompt=none (no UI). Returns true if session found.
  const silentSignIn = useCallback(async () => {
    const { authorization_endpoint } = await fetchOpenIdConfig()
    const u = new URL(authorization_endpoint)
    u.searchParams.set("scope", "openid email customer-account-api:full")
    u.searchParams.set("client_id", CLIENT_ID)
    u.searchParams.set("response_type", "code")
    u.searchParams.set("redirect_uri", REDIRECT)
    u.searchParams.set("prompt", "none") // 👈 silent check

    // Use a headless fetch, we only care about “login_required” vs a code
    // WebBrowser isn’t needed; server will redirect back to scheme (which RN can’t capture here),
    // but important bit: if no session, server returns 302 → REDIRECT?code=login_required
    // So: we parse only “final URL” by following redirects ourselves.
    // RN fetch won’t follow custom schemes, so we short-circuit: just attempt token refresh/load.
    // Practically: try to get a token; if not present, treat as not signed in.

    const t = await getValidAccessToken()
    if (t) {
      setToken(t)
      return true
    }
    // If you want to be aggressive, you can also try calling /authorize with prompt=none
    // inside a hidden WebView and sniff the final URL. Keeping it simple for now.
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
        const t = await getValidAccessToken()
        setToken(t)
      }
    })
    return () => sub.remove()
  }, [])

  // initial check on mount
  useEffect(() => {
    silentSignIn()
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
