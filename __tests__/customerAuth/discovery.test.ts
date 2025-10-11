import { __testables } from "@/lib/customerAuth/discovery"

describe("customerAuth discovery helpers", () => {
  it("normalizes discovery URLs", () => {
    expect(__testables.normalizeDiscoveryUrl("https://shop/.well-known/openid-configuration"))
      .toBe("https://shop/.well-known/openid-configuration")
    expect(__testables.normalizeDiscoveryUrl("https://shop"))
      .toBe("https://shop/.well-known/openid-configuration")
  })

  it("parses Retry-After header values", () => {
    expect(__testables.parseRetryAfter("5")).toBe(5000)
    const future = new Date(Date.now() + 3000).toUTCString()
    const parsed = __testables.parseRetryAfter(future)
    expect(parsed).toBeGreaterThan(0)
  })

  it("builds cache keys per shop", () => {
    expect(__testables.getCacheKey("openid", "example.com")).toBe("customer-auth:openid:example.com")
  })
})
