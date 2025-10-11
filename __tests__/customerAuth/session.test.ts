import { isExpiringSoon, tokensToSession } from "@/lib/customerAuth/session"
import type { OAuthTokens } from "@/lib/customerAuth/oauth"

describe("customerAuth session helpers", () => {
  it("detects expiry thresholds", () => {
    const now = Date.now()
    expect(isExpiringSoon(now + 60 * 1000, 120)).toBe(true)
    expect(isExpiringSoon(now + 10 * 60 * 1000, 120)).toBe(false)
  })

  it("maps OAuth tokens to session shape", () => {
    const tokens: OAuthTokens = {
      accessToken: "access",
      idToken: "id",
      refreshToken: "refresh",
      expiresIn: 3600,
      expiresAt: Date.now() + 3600 * 1000,
      tokenType: "Bearer",
      raw: {},
    }
    expect(tokensToSession(tokens)).toMatchObject({
      accessToken: "access",
      idToken: "id",
      refreshToken: "refresh",
    })
  })
})
