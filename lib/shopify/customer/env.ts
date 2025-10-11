const SHOP_ID_ENV = process.env.EXPO_PUBLIC_SHOPIFY_SHOP_ID?.trim() || ""
const FALLBACK_CLIENT_ID_ENV = process.env.EXPO_PUBLIC_SHOPIFY_CLIENT_ID?.trim() || ""
const CUSTOMER_CLIENT_ID_ENV = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID?.trim() || ""
const ISSUER_OVERRIDE_ENV = process.env.EXPO_PUBLIC_SHOPIFY_DISCOVERY_ISSUER?.trim() || ""
const GRAPHQL_OVERRIDE_ENV = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_ENDPOINT?.trim() || ""
const DOMAIN_FOR_LOGS_ENV = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim() || process.env.EXPO_PUBLIC_SHOPIFY_SHOP_DOMAIN?.trim() || ""
const SANITIZED_DOMAIN = DOMAIN_FOR_LOGS_ENV.replace(/^https?:\/\//, "").replace(/\/$/, "")

const parsedShopId = SHOP_ID_ENV ? Number(SHOP_ID_ENV) : NaN
if (!Number.isFinite(parsedShopId) || parsedShopId <= 0) {
  throw new Error("[CAAPI] Missing or invalid EXPO_PUBLIC_SHOPIFY_SHOP_ID")
}

export const SHOP_ID = parsedShopId
export const CUSTOMER_CLIENT_ID = CUSTOMER_CLIENT_ID_ENV || FALLBACK_CLIENT_ID_ENV
if (!CUSTOMER_CLIENT_ID) {
  throw new Error("[CAAPI] Missing EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID (or EXPO_PUBLIC_SHOPIFY_CLIENT_ID)")
}

export const OIDC_ISSUER = ISSUER_OVERRIDE_ENV || `https://shopify.com/authentication/${SHOP_ID}`
export const CAAPI_GRAPHQL_OVERRIDE = GRAPHQL_OVERRIDE_ENV
export const SHOP_DOMAIN_FOR_LOGS = SANITIZED_DOMAIN
export const SHOP_DOMAIN_HEADER = SANITIZED_DOMAIN

let verified = false

function sourceLabel(value: string | undefined, primary: string, fallback?: string) {
  if (value && value.trim().length > 0) return primary
  if (fallback && fallback.trim().length > 0) return fallback
  return "<unset>"
}

export function verifyCustomerEnv(): void {
  if (verified) return
  verified = true

  const shopIdSource = sourceLabel(SHOP_ID_ENV, "EXPO_PUBLIC_SHOPIFY_SHOP_ID")
  const clientIdSource = CUSTOMER_CLIENT_ID_ENV
    ? "EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID"
    : sourceLabel(FALLBACK_CLIENT_ID_ENV, "EXPO_PUBLIC_SHOPIFY_CLIENT_ID")
  const issuerSource = ISSUER_OVERRIDE_ENV ? "EXPO_PUBLIC_SHOPIFY_DISCOVERY_ISSUER" : "derived"
  const overrideSource = GRAPHQL_OVERRIDE_ENV ? "EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_ENDPOINT" : "<none>"
  const domainSource = DOMAIN_FOR_LOGS_ENV ? "EXPO_PUBLIC_SHOPIFY_DOMAIN/SHOP_DOMAIN" : "<none>"

  console.log("[CAAPI][env] SHOP_ID", SHOP_ID, "from", shopIdSource)
  console.log("[CAAPI][env] CLIENT_ID from", clientIdSource)
  console.log("[CAAPI][env] OIDC issuer", OIDC_ISSUER, "from", issuerSource)
  console.log("[CAAPI][env] GraphQL override", overrideSource)
  if (SANITIZED_DOMAIN) {
    console.log("[CAAPI][env] Domain (logs only)", SANITIZED_DOMAIN, "from", domainSource)
  }
}
