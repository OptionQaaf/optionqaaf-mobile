import { Buffer } from "buffer"
import * as Crypto from "expo-crypto"

// base64url without padding
const toBase64Url = (bytes: Uint8Array | string) => {
  const b64 = typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("base64")
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// CSRF guard
export function generateState(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// Replay guard
export function generateNonce(len = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// PKCE verifier: random 32 bytes → base64url
export function generateCodeVerifier(): string {
  const bytes = Crypto.getRandomBytes(32)
  return toBase64Url(bytes)
}

// PKCE challenge: SHA-256(verifier) → base64url
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  })
  return toBase64Url(digest)
}
