import { performHostedLogin } from "./oauth"
import {
  CustomerSession,
  ensureOpenId,
  getCachedSession,
  getFreshAccessToken,
  loadSession,
  logoutSession,
  storeSessionFromTokens,
} from "./session"

export async function loginWithOTP(options?: { locale?: string }): Promise<CustomerSession> {
  const { tokens, discovery } = await performHostedLogin(options)
  await ensureOpenId()
  return storeSessionFromTokens(tokens, discovery)
}

export async function getSession(): Promise<CustomerSession | null> {
  return (getCachedSession() as CustomerSession | null) ?? (await loadSession())
}

export async function getAccessToken(): Promise<string | null> {
  return getFreshAccessToken()
}

export async function logout(): Promise<void> {
  await logoutSession()
}

export async function ensureOpenIdContext() {
  await ensureOpenId()
}
