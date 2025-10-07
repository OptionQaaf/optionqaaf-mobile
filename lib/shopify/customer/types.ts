export type OpenIdConfig = {
  authorizationEndpoint: string
  tokenEndpoint: string
  endSessionEndpoint?: string
}

export type CustomerApiConfig = {
  graphqlApi: string
  mcpApi?: string | null
}

export type AuthTokens = {
  accessToken: string
  refreshToken?: string | null
  idToken?: string | null
  scope?: string | null
  tokenType?: string | null
  expiresIn: number
}

export type StoredCustomerSession = {
  shopDomain: string
  accessToken: string
  refreshToken?: string | null
  idToken?: string | null
  scope?: string | null
  tokenType?: string | null
  expiresAt: number
  graphqlEndpoint: string
  tokenEndpoint: string
  logoutEndpoint?: string | null
  idTokenIssuedAt?: number | null
}

export type CustomerBasicsQueryResult = {
  customer: {
    id: string
    displayName: string | null
    emailAddress?: { emailAddress: string | null } | null
    phone?: { phoneNumber: string | null } | null
    tags?: string[] | null
    defaultAddress?: CustomerAddress | null
  } | null
}

export type CustomerAddressesQueryResult = {
  customer: {
    addresses: {
      nodes: CustomerAddress[]
    }
  } | null
}

export type CustomerOrdersQueryVariables = {
  first?: number
}

export type CustomerOrdersQueryResult = {
  customer: {
    orders: {
      nodes: CustomerOrder[]
    }
  } | null
}

export type CustomerAddress = {
  id: string
  firstName: string | null
  lastName: string | null
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  zip: string | null
  country: string | null
  formatted: string[] | null
}

export type CustomerOrder = {
  id: string
  name: string | null
  orderNumber: number | null
  processedAt: string | null
  financialStatus: string | null
  fulfillmentStatus: string | null
  totalPriceSet?: {
    presentmentMoney?: {
      amount: string
      currencyCode: string
    } | null
  } | null
}

export type CustomerAccountSnapshot =
  | (CustomerBasicsQueryResult["customer"] & {
      addresses?: CustomerAddressesQueryResult["customer"] extends { addresses: infer A }
        ? A
        : { nodes: CustomerAddress[] }
      orders?: CustomerOrdersQueryResult["customer"] extends { orders: infer O } ? O : { nodes: CustomerOrder[] }
    })
  | null
