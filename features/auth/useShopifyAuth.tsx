// src/features/auth/useShopifyAuth.tsx
import { buildAuthorizationUrl, completeAuthorizationFromRedirect, getValidAccessToken, logoutShopify } from "@/lib/shopify/customer/auth"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { AppState } from "react-native"
import { useCartId } from "@/store/cartId"
import { router } from "expo-router"

// Minimal types
type Ctx = {
  isAuthenticated: boolean
  token?: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
  silentSignIn: () => Promise<boolean>
  getToken: () => Promise<string | null>
  initializing: boolean
  authUrl?: string | null
  handleAuthRedirect: (url: string) => Promise<void>
  cancelLogin: () => void
}

const AuthCtx = createContext<Ctx | null>(null)

export function ShopifyAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const loginPromiseRef = useRef<{ promise: Promise<void>; resolve: () => void; reject: (err: any) => void } | null>(null)
  const handledRedirectRef = useRef(false)
  const isAuthenticated = !!token

  const settleLogin = useCallback((error?: Error) => {
    const pending = loginPromiseRef.current
    loginPromiseRef.current = null
    setAuthUrl(null)
    if (!pending) return
    if (error) {
      pending.reject(error)
    } else {
      pending.resolve()
    }
  }, [])

  const login = useCallback(async () => {
    if (loginPromiseRef.current) {
      return loginPromiseRef.current.promise
    }

    handledRedirectRef.current = false

    const authorizeUrl = await buildAuthorizationUrl()

    let resolveFn!: () => void
    let rejectFn!: (err: any) => void
    const promise = new Promise<void>((resolve, reject) => {
      resolveFn = resolve
      rejectFn = reject
    })

    loginPromiseRef.current = { promise, resolve: resolveFn, reject: rejectFn }
    setAuthUrl(authorizeUrl)
    try {
      router.push({ pathname: "/auth", params: { url: encodeURIComponent(authorizeUrl) } })
    } catch (e) {
      // If navigation fails, reset state and bubble error
      settleLogin(e instanceof Error ? e : new Error("Could not open login screen"))
    }
    return promise
  }, [settleLogin])

  const handleAuthRedirect = useCallback(
    async (url: string) => {
      if (handledRedirectRef.current) return
      handledRedirectRef.current = true
      try {
        await completeAuthorizationFromRedirect(url)
        const t = await getValidAccessToken()
        if (!t) throw new Error("No token returned from login")
        setToken(t || null)
        settleLogin()
      } catch (err: any) {
        const message = err?.message || "Login failed"
        settleLogin(new Error(message))
      }
    },
    [settleLogin],
  )

  useEffect(() => {
    handledRedirectRef.current = false
  }, [authUrl])

  const cancelLogin = useCallback(() => settleLogin(new Error("Login cancelled")), [settleLogin])

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
      authUrl,
      handleAuthRedirect,
      cancelLogin,
    }),
    [isAuthenticated, token, login, logout, silentSignIn, getToken, initializing, authUrl, handleAuthRedirect, cancelLogin],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useShopifyAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error("useShopifyAuth must be used inside <ShopifyAuthProvider>")
  return ctx
}
