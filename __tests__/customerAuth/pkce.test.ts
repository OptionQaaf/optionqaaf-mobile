import { __testables } from "@/lib/customerAuth/oauth"

describe("customerAuth oauth helpers", () => {
  it("generates url safe random strings of the requested length", async () => {
    const value = __testables.randomUrlSafeString(64)
    expect(value).toHaveLength(64)
    expect(value).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it("produces PKCE pair with matching verifier and challenge", async () => {
    const { codeVerifier, codeChallenge } = await __testables.generatePkcePair()
    expect(codeVerifier).toHaveLength(64)
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(codeChallenge.endsWith("=")).toBe(false)
  })
})
