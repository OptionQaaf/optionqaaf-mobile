import * as AuthSession from "expo-auth-session"

import { getShopifyCustomerConfig } from "./config"

export type OidcEndpoints = {
  authorizationEndpoint: string
  tokenEndpoint: string
  endSessionEndpoint?: string | null
}

let cachedEndpoints: OidcEndpoints | null = null
let cachedAt = 0

export async function getOidcEndpoints(options?: { forceRefresh?: boolean }): Promise<OidcEndpoints> {
  const config = getShopifyCustomerConfig()

  if (!options?.forceRefresh && cachedEndpoints) {
    return cachedEndpoints
  }

  if (config.authorizationEndpointOverride && config.tokenEndpointOverride) {
    const endpoints: OidcEndpoints = {
      authorizationEndpoint: config.authorizationEndpointOverride,
      tokenEndpoint: config.tokenEndpointOverride,
      endSessionEndpoint: config.logoutEndpointOverride ?? null,
    }
    cachedEndpoints = endpoints
    cachedAt = Date.now()
    if (typeof __DEV__ === "undefined" || __DEV__) {
      console.log("[CAAPI][oauth] Using OIDC overrides")
    }
    return endpoints
  }

  const discovery = await AuthSession.fetchDiscoveryAsync(config.issuer)
  if (!discovery?.authorizationEndpoint || !discovery?.tokenEndpoint) {
    throw new Error("Customer Account OIDC discovery failed: missing authorization/token endpoints")
  }

  const endpoints: OidcEndpoints = {
    authorizationEndpoint: discovery.authorizationEndpoint,
    tokenEndpoint: discovery.tokenEndpoint,
    endSessionEndpoint:
      config.logoutEndpointOverride ?? discovery.endSessionEndpoint ?? discovery.revocationEndpoint ?? null,
  }

  cachedEndpoints = endpoints
  cachedAt = Date.now()

  if (typeof __DEV__ === "undefined" || __DEV__) {
    console.log("[CAAPI][oauth] Discovered OIDC endpoints", {
      authorizationEndpoint: endpoints.authorizationEndpoint,
      tokenEndpoint: endpoints.tokenEndpoint,
      endSessionEndpoint: endpoints.endSessionEndpoint,
      cachedAt,
    })
  }

  return endpoints
}

export function clearOidcCache() {
  cachedEndpoints = null
  cachedAt = 0
}
