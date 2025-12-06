import { generateCodeChallenge, generateCodeVerifier, generateNonce, generateState } from "@/lib/oauth/pkce"
import {
  SHOPIFY_CUSTOMER_CLIENT_ID as CLIENT_ID,
  ORIGIN_HEADER,
  SHOPIFY_CUSTOMER_REDIRECT_URI as REDIRECT_URI,
  USER_AGENT,
} from "@/lib/shopify/env"
import { sdel, sget, sset } from "@/lib/storage/secureStore"
import { router } from "expo-router"
import { fetchOpenIdConfig } from "./discovery"

const K = {
  CODE_VERIFIER: "shopify.pkce.verifier",
  STATE: "shopify.oauth.state",
  NONCE: "shopify.oauth.nonce",
  AT: "shopify.token.access",
  RT: "shopify.token.refresh",
  IDT: "shopify.token.id",
  EXP: "shopify.token.exp",
}

let refreshInFlight: Promise<string | null> | null = null

type TokenResponse = {
  access_token: string
  refresh_token: string
  id_token: string
  expires_in: number
}

type PrepareAuthorizationOptions = {
  prompt?: string
  persist?: boolean
}

type PreparedAuthorization = {
  url: URL
  state: string
  verifier: string
}

type LoginPromiseHandlers = {
  resolve: () => void
  reject: (err: Error) => void
}

let loginPromise: LoginPromiseHandlers | null = null

async function prepareAuthorizationRequest(options: PrepareAuthorizationOptions = {}): Promise<PreparedAuthorization> {
  const openId = await fetchOpenIdConfig()

  const { prompt, persist = true } = options

  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()
  const nonce = generateNonce(24)

  if (persist) {
    await Promise.all([sset(K.CODE_VERIFIER, verifier), sset(K.STATE, state), sset(K.NONCE, nonce)])
  }

  const url = new URL(openId.authorization_endpoint)
  url.searchParams.set("scope", "openid email customer-account-api:full")
  url.searchParams.set("client_id", CLIENT_ID)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", REDIRECT_URI)
  url.searchParams.set("state", state)
  url.searchParams.set("nonce", nonce)
  url.searchParams.set("code_challenge", challenge)
  url.searchParams.set("code_challenge_method", "S256")

  if (prompt) {
    url.searchParams.set("prompt", prompt)
  }

  return { url, state, verifier }
}

function resolveLogin() {
  loginPromise?.resolve()
  loginPromise = null
}

function rejectLogin(err: Error) {
  loginPromise?.reject(err)
  loginPromise = null
}

let silentAuthorizePromise: Promise<string | null> | null = null

async function runSilentAuthorization(): Promise<string | null> {
  const { url, state, verifier } = await prepareAuthorizationRequest({ prompt: "none", persist: false })

  let res: Response
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        Origin: ORIGIN_HEADER,
        "User-Agent": USER_AGENT,
      },
      credentials: "include",
    })
  } catch (networkError) {
    console.warn("Silent authorize failed (network)", networkError)
    return null
  }

  const location = res.headers.get("location")
  if (!location) {
    return null
  }

  let redirectUrl: URL
  try {
    redirectUrl = new URL(location)
  } catch {
    try {
      redirectUrl = new URL(location, REDIRECT_URI)
    } catch {
      console.warn("Silent authorize failed: invalid redirect URL", location)
      return null
    }
  }

  const error = redirectUrl.searchParams.get("error")
  if (error) {
    if (error === "login_required" || error === "interaction_required") {
      return null
    }
    console.warn("Silent authorize failed:", error)
    return null
  }

  const returnedState = redirectUrl.searchParams.get("state") || ""
  if (returnedState && returnedState !== state) {
    console.warn("Silent authorize failed: state mismatch")
    return null
  }

  const code = redirectUrl.searchParams.get("code")
  if (!code) {
    return null
  }

  try {
    await exchangeToken(code, { verifier })
  } catch (err) {
    console.warn("Silent authorize failed: token exchange error", err)
    return null
  }

  return (await sget(K.AT)) || null
}

export async function authorizeSilently(): Promise<string | null> {
  if (!silentAuthorizePromise) {
    silentAuthorizePromise = runSilentAuthorization().finally(() => {
      silentAuthorizePromise = null
    })
  }
  return silentAuthorizePromise
}

export async function startLogin(): Promise<void> {
  if (loginPromise) {
    throw new Error("Login already in progress")
  }

  const { url: authorizeUrl } = await prepareAuthorizationRequest()

  return new Promise((resolve, reject) => {
    loginPromise = { resolve, reject }
    try {
      router.push({ pathname: "/(auth)/authorize", params: { url: authorizeUrl.toString() } })
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Login could not be started")
      rejectLogin(error)
    }
  })
}

export async function handleAuthorizationRedirect(redirectUrl: string): Promise<void> {
  if (!loginPromise) {
    throw new Error("No active login session")
  }

  const params = new URL(redirectUrl).searchParams
  const oauthError = params.get("error")
  if (oauthError) {
    const err = new Error(oauthError)
    rejectLogin(err)
    throw err
  }
  const returnedState = params.get("state") || ""
  const expectedState = (await sget(K.STATE)) || ""
  if (returnedState !== expectedState) {
    rejectLogin(new Error("State mismatch"))
    throw new Error("State mismatch")
  }

  const code = params.get("code")
  if (!code) {
    rejectLogin(new Error("No authorization code returned"))
    throw new Error("No authorization code returned")
  }

  try {
    await exchangeToken(code)
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Could not complete sign in")
    rejectLogin(error)
    throw error
  }

  resolveLogin()
}

export function cancelLogin(reason = "Login cancelled/failed") {
  rejectLogin(new Error(reason))
}

export async function exchangeToken(code: string, options: { verifier?: string } = {}): Promise<void> {
  const openId = await fetchOpenIdConfig()
  const verifier = options.verifier ?? ((await sget(K.CODE_VERIFIER)) || "")

  const cleanClientId = CLIENT_ID.trim()
  const cleanRedirect = REDIRECT_URI.trim()

  // RN-safe x-www-form-urlencoded string
  const body =
    `grant_type=authorization_code` +
    `&client_id=${encodeURIComponent(cleanClientId)}` +
    `&redirect_uri=${encodeURIComponent(cleanRedirect)}` +
    `&code=${encodeURIComponent(code)}` +
    `&code_verifier=${encodeURIComponent(verifier)}`

  const res = await fetch(openId.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      // 👇 add these back; some edges need them to mint the right token type
      Origin: ORIGIN_HEADER,
      "User-Agent": USER_AGENT,
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Token exchange failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as TokenResponse
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (json.expires_in ?? 1800)

  await sset(K.AT, json.access_token)
  await sset(K.RT, json.refresh_token)
  await sset(K.IDT, json.id_token)
  await sset(K.EXP, String(exp))

  // 👇 TEMP: prove we got a customer access token
  console.log("TOKEN PREFIX →", json.access_token?.slice(0, 7)) // should log 'shcat_'
}

export async function getValidAccessToken(): Promise<string | null> {
  const at = await sget(K.AT)
  const exp = Number((await sget(K.EXP)) || 0)
  const now = Math.floor(Date.now() / 1000)
  if (at && exp - 60 > now) return at

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const previousToken = at || null
      const rt = await sget(K.RT)
      if (!rt) return null
      try {
        await refreshToken(rt)
        return (await sget(K.AT)) || previousToken
      } catch (err: any) {
        const code = err?.code
        if (code === "invalid_grant") {
          return null
        }
        return previousToken
      }
    })().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight!
}

export async function refreshToken(refreshToken: string): Promise<void> {
  const openId = await fetchOpenIdConfig()
  const cleanClientId = CLIENT_ID.trim()
  const cleanRefreshToken = refreshToken.trim()

  const body =
    `grant_type=refresh_token` +
    `&client_id=${encodeURIComponent(cleanClientId)}` +
    `&refresh_token=${encodeURIComponent(cleanRefreshToken)}`

  let res: Response
  try {
    res = await fetch(openId.token_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Origin: ORIGIN_HEADER,
        "User-Agent": USER_AGENT,
      },
      body,
    })
  } catch (networkError: any) {
    const err = new Error("Refresh failed: network error")
    ;(err as any).code = "network"
    err.cause = networkError
    throw err
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    const err = new Error(`Refresh failed: ${res.status} ${text}`)
    if (res.status === 400 || res.status === 401) {
      ;(err as any).code = "invalid_grant"
      err.cause = text
      await logoutLocal()
    } else {
      ;(err as any).code = "refresh_failed"
      err.cause = text
    }
    throw err
  }

  const json = (await res.json()) as TokenResponse & { refresh_token: string }
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (json.expires_in ?? 1800)

  await sset(K.AT, json.access_token)
  await sset(K.RT, json.refresh_token)
  await sset(K.IDT, json.id_token)
  await sset(K.EXP, String(exp))
}

export async function logoutShopify(): Promise<void> {
  const openId = await fetchOpenIdConfig()
  const idt = await sget(K.IDT)
  if (idt) {
    const u = new URL(openId.end_session_endpoint)
    u.searchParams.set("id_token_hint", idt)
    // Mobile supports 200 OK without redirect
    await fetch(u.toString(), { headers: { "User-Agent": USER_AGENT } }).catch(() => {})
  }
  await logoutLocal()
}

export async function logoutLocal(): Promise<void> {
  await Promise.all(Object.values(K).map((k) => sdel(k)))
}

// Debug helper: force the stored access-token expiration into the past so the next guarded call refreshes.
export async function fastForwardAccessTokenExpiry(seconds = 3600): Promise<number> {
  const storedExp = Number((await sget(K.EXP)) || 0)
  const baseline = Number.isFinite(storedExp) && storedExp > 0 ? storedExp : Math.floor(Date.now() / 1000)
  const newExp = baseline - seconds
  await sset(K.EXP, String(newExp))
  return newExp
}
