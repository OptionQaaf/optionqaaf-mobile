import { useCallback, useMemo } from "react"
import * as WebBrowser from "expo-web-browser"
import { router } from "expo-router"
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { waitForAuthRedirect } from "@/lib/auth-session/handleRedirect"
import {
  SHOPIFY_CUSTOMER_CLIENT_ID,
  SHOPIFY_CUSTOMER_REDIRECT_URI,
  SHOPIFY_DOMAIN,
} from "@/lib/shopify/env"
import { kv } from "@/lib/storage/mmkv"
import { secureKv } from "@/lib/storage/secureKv"
import { qk } from "@/lib/shopify/queryKeys"
import {
  SHOPIFY_CUSTOMER_SCOPES,
  CustomerAuthError,
  AuthDiscovery,
  createPkce,
  decodeJwtPayload,
  getAuthDiscoveryCached,
  exchangeCodeForToken,
  generateNonce,
  generateState,
  logout as logoutRemote,
  refreshAccessToken,
} from "@/lib/shopify/customer/auth"
import { getOpenIdConfigOverride } from "@/lib/shopify/customer/discovery"
import { callCustomerApi, createCustomerGqlClient, CustomerApiError } from "@/lib/shopify/customer/client"

const TOKEN_KEY = "auth.customer"
const PENDING_KEY = "auth.customer.pending"
const EXPIRY_GRACE_MS = 60_000 // refresh slightly ahead of expiry
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const storedTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().nullable().optional(),
  idToken: z.string().nullable().optional(),
  expiryEpoch: z.number(),
  issuedAt: z.number(),
  shopDomain: z.string(),
  scope: z.string().nullable().optional(),
  tokenType: z.string().nullable().optional(),
})

const pendingSchema = z.object({
  codeVerifier: z.string(),
  state: z.string(),
  nonce: z.string().optional(),
  createdAt: z.number(),
})

type StoredTokens = z.infer<typeof storedTokenSchema>
type PendingAuth = z.infer<typeof pendingSchema>

export const customerOverviewSchema = z.object({
  customer: z
    .object({
      id: z.string(),
      firstName: z.string().nullable().optional(),
      lastName: z.string().nullable().optional(),
      emailAddress: z
        .object({
          emailAddress: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      phoneNumber: z
        .object({
          phoneNumber: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      addresses: z.object({
        nodes: z
          .array(
            z.object({
              id: z.string(),
              firstName: z.string().nullable().optional(),
              lastName: z.string().nullable().optional(),
              address1: z.string().nullable().optional(),
              address2: z.string().nullable().optional(),
              city: z.string().nullable().optional(),
              provinceCode: z.string().nullable().optional(),
              zip: z.string().nullable().optional(),
              countryCode: z.string().nullable().optional(),
            }),
          )
          .optional(),
      }),
      orders: z.object({
        nodes: z
          .array(
            z.object({
              id: z.string(),
              name: z.string().nullable().optional(),
              orderNumber: z.number().nullable().optional(),
              processedAt: z.string().nullable().optional(),
              currentTotalPrice: z
                .object({
                  amount: z.string().nullable().optional(),
                  currencyCode: z.string().nullable().optional(),
                })
                .nullable()
                .optional(),
            }),
          )
          .optional(),
      }),
    })
    .nullable(),
})

export type CustomerOverview = z.infer<typeof customerOverviewSchema>["customer"]

let inMemoryTokens: StoredTokens | null = null
let refreshPromise: Promise<StoredTokens> | null = null

async function readTokens(): Promise<StoredTokens | null> {
  if (inMemoryTokens) return inMemoryTokens
  let raw: string | null
  try {
    raw = await secureKv.get(TOKEN_KEY)
  } catch {
    raw = kv.get(TOKEN_KEY) ?? null
  }
  if (!raw) return null
  try {
    const parsed = storedTokenSchema.parse(JSON.parse(raw))
    inMemoryTokens = parsed
    return parsed
  } catch {
    await secureKv.del(TOKEN_KEY)
    inMemoryTokens = null
    return null
  }
}

async function persistTokens(tokens: StoredTokens | null) {
  inMemoryTokens = tokens
  if (!tokens) {
    await secureKv.del(TOKEN_KEY)
    return
  }
  await secureKv.set(TOKEN_KEY, JSON.stringify(tokens))
}

function persistPending(pending: PendingAuth | null) {
  if (!pending) kv.del(PENDING_KEY)
  else kv.set(PENDING_KEY, JSON.stringify(pending))
}

function refreshEligible(tokens: StoredTokens): boolean {
  if (!tokens.refreshToken) return false
  const now = Date.now()
  if (now + EXPIRY_GRACE_MS < tokens.expiryEpoch) return false
  if (now - tokens.expiryEpoch > REFRESH_WINDOW_MS) return false
  return true
}

function alreadyExpired(tokens: StoredTokens): boolean {
  return Date.now() >= tokens.expiryEpoch
}

async function ensureFreshTokens(current: StoredTokens, force = false): Promise<StoredTokens | null> {
  if (!force && !refreshEligible(current)) {
    if (alreadyExpired(current)) {
      await persistTokens(null)
      return null
    }
    return current
  }
  if (!current.refreshToken) {
    if (force) {
      await persistTokens(null)
      return null
    }
    return current
  }
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const refreshed = await refreshAccessToken({
        refreshToken: current.refreshToken!,
        shopDomain: current.shopDomain,
      })
      const issuedAt = Date.now()
      const next: StoredTokens = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? current.refreshToken,
        idToken: refreshed.idToken ?? current.idToken,
        scope: refreshed.scope ?? current.scope,
        tokenType: refreshed.tokenType ?? current.tokenType,
        issuedAt,
        expiryEpoch: issuedAt + refreshed.expiresIn * 1000,
        shopDomain: current.shopDomain,
      }
      await persistTokens(next)
      return next
    } catch (error) {
      await persistTokens(null)
      throw error
    } finally {
      refreshPromise = null
    }
  })()
  try {
    return await refreshPromise
  } catch {
    return null
  }
}

async function loadSession(): Promise<CustomerSessionState> {
  const existing = await readTokens()
  if (!existing) return { status: "unauthenticated" }
  const fresh = await ensureFreshTokens(existing)
  if (!fresh) return { status: "unauthenticated" }
  return { status: "authenticated", tokens: fresh }
}

export async function getCustomerOverviewData(tokens: StoredTokens): Promise<CustomerOverview | null> {
  const client = await createCustomerGqlClient(tokens.accessToken, tokens.shopDomain)

  const exec = (headers?: Record<string, string>) =>
    callCustomerApi(() => client.rawRequest(CUSTOMER_OVERVIEW_QUERY, undefined, headers))

  const data = await exec()
  const parsed = customerOverviewSchema.parse(data)
  return parsed.customer ?? null
}

export async function prefetchCustomer(_: QueryClient, __?: StoredTokens | null) {}

type CustomerSessionState =
  | { status: "unauthenticated" }
  | { status: "authenticated"; tokens: StoredTokens }

type UseCustomerSessionResult = {
  status: "loading" | CustomerSessionState["status"]
  accessToken: string | null
  customer: CustomerOverview | null
  isFetchingCustomer: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  error: Error | null
}

export function useCustomerSession(): UseCustomerSessionResult {
  const qc = useQueryClient()
  const session = useQuery({
    queryKey: qk.customerSession(),
    queryFn: loadSession,
    gcTime: 0,
    staleTime: 0,
    retry: 0,
  })

  const customerQuery = useQuery({
    queryKey: qk.customerOverview(),
    queryFn: async () => {
      if (session.data?.status !== "authenticated") return null
      try {
        return await getCustomerOverviewData(session.data.tokens)
      } catch (error) {
        if (
          error instanceof CustomerApiError &&
          (error.status === 401 || error.invalidToken === true) &&
          session.data.tokens.refreshToken
        ) {
          const refreshed = await ensureFreshTokens(session.data.tokens, true)
          if (!refreshed) throw error
          await qc.setQueryData(qk.customerSession(), { status: "authenticated", tokens: refreshed })
          return getCustomerOverviewData(refreshed)
        }
        throw error
      }
    },
    enabled: session.data?.status === "authenticated" && !!session.data.tokens.accessToken,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof CustomerApiError && (error.status === 404 || error.status === 429)) return false
      return failureCount < 1
    },
  })

  const refresh = useCallback(async () => {
    const current = await readTokens()
    if (!current) {
      await persistTokens(null)
      await qc.invalidateQueries({ queryKey: qk.customerSession() as any })
      return
    }
    const refreshed = await ensureFreshTokens(current)
    if (!refreshed) {
      await persistTokens(null)
    }
    await qc.invalidateQueries({ queryKey: qk.customerSession() as any })
    await qc.invalidateQueries({ queryKey: qk.customerOverview() as any, refetchType: "none" })
  }, [qc])

  const logout = useCallback(async () => {
    const tokens = await readTokens()
    if (tokens?.idToken) {
      await logoutRemote({ idToken: tokens.idToken, shopDomain: tokens.shopDomain })
    }
    await persistTokens(null)
    await qc.invalidateQueries({ queryKey: qk.customerSession() as any })
    await qc.removeQueries({ queryKey: qk.customerOverview() as any })
  }, [qc])

  const result = useMemo<UseCustomerSessionResult>(() => {
    const status: UseCustomerSessionResult["status"] = session.isLoading
      ? "loading"
      : session.data?.status ?? "unauthenticated"
    const accessToken = session.data?.status === "authenticated" ? session.data.tokens.accessToken : null
    return {
      status,
      accessToken,
      customer: customerQuery.data ?? null,
      isFetchingCustomer: customerQuery.isFetching,
      refresh,
      logout,
      error: customerQuery.error instanceof Error ? customerQuery.error : null,
    }
  }, [session.data, session.isLoading, customerQuery.data, customerQuery.isFetching, refresh, logout])

  return result
}

type LoginResult = {
  customer: CustomerOverview | null
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation<LoginResult, Error>({
    mutationFn: async () => {
      const shopDomain = SHOPIFY_DOMAIN
      const openIdOverride = getOpenIdConfigOverride()
      let discoveryTimeout: ReturnType<typeof setTimeout> | null = null
      let auth: AuthDiscovery
      try {
        if (openIdOverride) {
          auth = await getAuthDiscoveryCached(shopDomain)
        } else {
          auth = await Promise.race([
            getAuthDiscoveryCached(shopDomain),
            new Promise<AuthDiscovery>((_, reject) => {
              discoveryTimeout = setTimeout(() => {
                reject(new CustomerAuthError("Discovery timed out", "DISCOVERY_TIMEOUT"))
              }, 10_000)
            }),
          ])
        }
      } finally {
        if (discoveryTimeout) clearTimeout(discoveryTimeout)
      }
      const { verifier, challenge } = await createPkce()
      const state = generateState()
      const nonce = generateNonce()

      const pending: PendingAuth = { codeVerifier: verifier, state, nonce, createdAt: Date.now() }
      persistPending(pending)

      let tokensSaved = false
      try {
        const authorize = new URL(auth.authorizationEndpoint)
        authorize.searchParams.set("client_id", SHOPIFY_CUSTOMER_CLIENT_ID)
        authorize.searchParams.set("scope", SHOPIFY_CUSTOMER_SCOPES)
        authorize.searchParams.set("response_type", "code")
        authorize.searchParams.set("redirect_uri", SHOPIFY_CUSTOMER_REDIRECT_URI)
        authorize.searchParams.set("state", state)
        if (nonce) authorize.searchParams.set("nonce", nonce)
        authorize.searchParams.set("code_challenge", challenge)
        authorize.searchParams.set("code_challenge_method", "S256")

        const waitRedirect = waitForAuthRedirect()
        const result = await WebBrowser.openAuthSessionAsync(
          authorize.toString(),
          SHOPIFY_CUSTOMER_REDIRECT_URI,
        )

        if (result.type === "cancel" || result.type === "dismiss") {
          void waitRedirect.catch(() => {})
          throw new Error("Login cancelled")
        }

        let params = result.type === "success" && result.url ? parseAuthParams(result.url) : null
        if (params) {
          void waitRedirect.catch(() => {})
        } else {
          params = await waitRedirect
        }
        if (!params) throw new Error("Login failed: missing redirect payload")

        if (params.error) {
          throw new Error(params.errorDescription || params.error)
        }
        if (!params.code) throw new Error("Missing authorization code")
        if (params.state !== pending.state) {
          throw new Error("State mismatch. Please try again.")
        }

        const tokens = await exchangeCodeForToken({
          code: params.code,
          codeVerifier: pending.codeVerifier,
          redirectUri: SHOPIFY_CUSTOMER_REDIRECT_URI,
          shopDomain,
        })

        if (tokens.idToken && pending.nonce) {
          const payload = decodeJwtPayload<{ nonce?: string }>(tokens.idToken)
          if (payload?.nonce && payload.nonce !== pending.nonce) {
            throw new Error("Nonce mismatch. Please retry login.")
          }
        }

        const issuedAt = Date.now()
        const stored: StoredTokens = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? null,
          idToken: tokens.idToken ?? null,
          scope: tokens.scope ?? null,
          tokenType: tokens.tokenType ?? null,
          issuedAt,
          expiryEpoch: issuedAt + tokens.expiresIn * 1000,
          shopDomain,
        }
        await persistTokens(stored)
        tokensSaved = true

        await qc.invalidateQueries({ queryKey: qk.customerSession() as any })
        await prefetchCustomer(qc, stored).catch(() => {})
        router.replace("/account")

        const cached = qc.getQueryData<CustomerOverview | null>(qk.customerOverview()) ?? null
        return { customer: cached }
      } catch (error) {
        if (!tokensSaved) await persistTokens(null)
        let message = error instanceof Error ? error.message : "Login failed"
        if (
          error instanceof CustomerAuthError ||
          (typeof message === "string" && (/429/.test(message) || /Too many attempts/i.test(message)))
        ) {
          message = "Shopify is limiting logins right now. Try again in ~30s or use the fallback."
        }
        throw new Error(message)
      } finally {
        persistPending(null)
        try {
          if (typeof (WebBrowser as any).dismissBrowserAsync === "function") {
            await (WebBrowser as any).dismissBrowserAsync()
          } else if (typeof (WebBrowser as any).dismissBrowser === "function") {
            await Promise.resolve((WebBrowser as any).dismissBrowser())
          }
        } catch {
          // ignore – some Expo runtimes do not expose dismiss helpers
        }
      }
    },
  })
}

function parseAuthParams(url: string) {
  const parsed = new URL(url)
  const params: Record<string, string> = {}
  parsed.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return {
    code: params.code,
    state: params.state,
    error: params.error,
    errorDescription: params.error_description,
  }
}

export const CUSTOMER_OVERVIEW_QUERY = `#graphql
  query CustomerOverviewLite {
    customer {
      id
      firstName
      lastName
      emailAddress {
        emailAddress
      }
      orders(first: 5, reverse: true) {
        nodes {
          id
          name
          processedAt
          currentTotalPrice {
            amount
            currencyCode
          }
        }
      }
      addresses(first: 8) {
        nodes {
          id
          firstName
          lastName
          city
          countryCode
          address1
          address2
          zip
          provinceCode
        }
      }
    }
  }
`
