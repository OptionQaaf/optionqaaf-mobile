import { generateCodeChallenge, generateCodeVerifier, generateNonce, generateState } from "@/lib/oauth/pkce"
import {
  SHOPIFY_CUSTOMER_CLIENT_ID as CLIENT_ID,
  ORIGIN_HEADER,
  SHOPIFY_CUSTOMER_REDIRECT_URI as REDIRECT_URI,
  USER_AGENT,
} from "@/lib/shopify/env"
import { sdel, sget, sset } from "@/lib/storage/secureStore"
import * as WebBrowser from "expo-web-browser"
import { fetchOpenIdConfig } from "./discovery"

WebBrowser.maybeCompleteAuthSession()

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

export async function startLogin(): Promise<void> {
  const openId = await fetchOpenIdConfig()

  // PKCE + CSRF guards
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()
  const nonce = generateNonce(24)

  await sset(K.CODE_VERIFIER, verifier)
  await sset(K.STATE, state)
  await sset(K.NONCE, nonce)

  // Build the authorize URL
  const u = new URL(openId.authorization_endpoint)
  u.searchParams.set("scope", "openid email customer-account-api:full") // or your env scopes
  u.searchParams.set("client_id", CLIENT_ID)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("redirect_uri", REDIRECT_URI) // 👈 /callback
  u.searchParams.set("state", state)
  u.searchParams.set("nonce", nonce)
  u.searchParams.set("code_challenge", challenge)
  u.searchParams.set("code_challenge_method", "S256")

  console.log("AUTHZ DEBUG → authorization_endpoint:", u.toString())
  console.log("AUTHZ DEBUG → redirect_uri:", REDIRECT_URI)

  // Open in-app browser and wait for redirect
  const result = await WebBrowser.openAuthSessionAsync(u.toString(), REDIRECT_URI)
  if (result.type !== "success" || !result.url) throw new Error("Login cancelled/failed")

  const params = new URL(result.url).searchParams
  const returnedState = params.get("state") || ""
  const expectedState = (await sget(K.STATE)) || ""
  if (returnedState !== expectedState) throw new Error("State mismatch")

  const code = params.get("code")
  if (!code) throw new Error("No authorization code returned")

  await exchangeToken(code)
}

export async function exchangeToken(code: string): Promise<void> {
  const openId = await fetchOpenIdConfig()
  const verifier = (await sget(K.CODE_VERIFIER)) || ""

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
  const body = new URLSearchParams()
  body.set("grant_type", "refresh_token")
  body.set("client_id", CLIENT_ID)
  body.set("refresh_token", refreshToken)

  let res: Response
  try {
    res = await fetch(openId.token_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Origin: ORIGIN_HEADER,
        "User-Agent": USER_AGENT,
        "Shopify-Shop-Id": "85072904499",
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
