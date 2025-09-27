import { ShopifyError, callShopify } from "@/lib/shopify/client"
import { SHOPIFY_API_VERSION, SHOPIFY_DOMAIN } from "@/lib/shopify/env"
import type {
  AddressConnection,
  AddressNode,
  CustomerAddressCreateResult,
  CustomerAddressDeleteResult,
  CustomerAddressInput,
  CustomerAddressUpdateResult,
  CustomerAddressesResult,
  CustomerDefaultAddressUpdateResult,
  CustomerOverviewResult,
  CustomerOrdersResult,
  CustomerUpdateInput,
  CustomerUpdateResult,
  GraphQLUserError,
  MailingAddressInput,
  OrdersConnection,
} from "@/lib/shopify/types/customer"

const METADATA_TTL_MS = 5 * 60 * 1000
const METADATA_ERROR_TTL_MS = 60 * 1000

function sanitizeDomain(domain: string) {
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

const SHOP_DOMAIN = sanitizeDomain(SHOPIFY_DOMAIN)
const SHOP_ORIGIN = `https://${SHOP_DOMAIN}`
const CUSTOMER_ACCOUNT_GRAPHQL_BASE = `${SHOP_ORIGIN}/customer-account/api/${SHOPIFY_API_VERSION}/graphql`

function coerceUrl(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function ensureGraphqlEndpoint(endpoint?: string | null) {
  const raw = coerceUrl(endpoint)
  if (!raw) {
    return `${CUSTOMER_ACCOUNT_GRAPHQL_BASE}.json`
  }
  const sanitized = raw.replace(/\s+/g, "").replace(/\/+$/, "")
  if (sanitized.endsWith("/graphql.json")) return sanitized
  if (sanitized.endsWith("/graphql")) return `${sanitized}.json`
  if (sanitized.endsWith(".json")) return sanitized
  return `${sanitized}/graphql.json`
}
const WELL_KNOWN_URL = `${SHOP_ORIGIN}/.well-known/customer-account-api`
const DEFAULT_PORTAL_URL = `${SHOP_ORIGIN}/account`

type WellKnownResponse = {
  graphql_api?: string
  account_url?: string | null
  account_management_url?: string | null
}

type CustomerAccountMetadata = {
  graphqlEndpoint: string
  accountPortalUrl: string | null
  accountManagementUrl: string | null
  expiresAt: number
}

class CustomerAccountApiError extends ShopifyError {
  status?: number
  endpoint?: string
  requestId?: string | null
  body?: string
  errors?: string[]

  constructor(
    message: string,
    init?: {
      status?: number
      endpoint?: string
      requestId?: string | null
      body?: string
      errors?: string[]
      cause?: unknown
    },
  ) {
    super(message, init?.cause)
    this.name = "CustomerAccountApiError"
    this.status = init?.status
    this.endpoint = init?.endpoint
    this.requestId = init?.requestId ?? null
    this.body = init?.body
    this.errors = init?.errors
  }
}

let metadataCache: CustomerAccountMetadata | null = null
let metadataPromise: Promise<CustomerAccountMetadata> | null = null

function createMetadata(payload: WellKnownResponse | null | undefined, ttl: number): CustomerAccountMetadata {
  const portalCandidate =
    coerceUrl(payload?.account_management_url) || coerceUrl(payload?.account_url) || DEFAULT_PORTAL_URL
  return {
    graphqlEndpoint: ensureGraphqlEndpoint(payload?.graphql_api),
    accountPortalUrl: portalCandidate,
    accountManagementUrl: coerceUrl(payload?.account_management_url),
    expiresAt: Date.now() + ttl,
  }
}

async function fetchCustomerMetadata(): Promise<CustomerAccountMetadata> {
  let response: Response
  try {
    response = await fetch(WELL_KNOWN_URL, { headers: { Accept: "application/json" } })
  } catch (error) {
    throw new CustomerAccountApiError("Unable to reach Shopify customer metadata endpoint", {
      endpoint: WELL_KNOWN_URL,
      cause: error,
    })
  }

  const requestId = response.headers.get("x-request-id")
  let body = ""
  try {
    body = await response.text()
  } catch (error) {
    throw new CustomerAccountApiError("Unable to read Shopify customer metadata response", {
      endpoint: WELL_KNOWN_URL,
      status: response.status,
      requestId,
      cause: error,
    })
  }

  if (!response.ok) {
    throw new CustomerAccountApiError(`Failed to load customer metadata (${response.status})`, {
      endpoint: WELL_KNOWN_URL,
      status: response.status,
      requestId,
      body,
    })
  }

  let payload: WellKnownResponse | null = null
  if (body.trim().length) {
    try {
      payload = JSON.parse(body) as WellKnownResponse
    } catch (error) {
      throw new CustomerAccountApiError("Customer metadata payload malformed", {
        endpoint: WELL_KNOWN_URL,
        status: response.status,
        requestId,
        body,
        cause: error,
      })
    }
  }

  return createMetadata(payload ?? undefined, METADATA_TTL_MS)
}

async function getCustomerAccountMetadata(options?: { force?: boolean }) {
  if (options?.force) {
    metadataCache = null
    metadataPromise = null
  }

  if (metadataCache && metadataCache.expiresAt > Date.now()) {
    return metadataCache
  }

  if (!metadataPromise) {
    metadataPromise = fetchCustomerMetadata()
      .catch((error) => {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[Shopify] Unable to resolve Customer Account metadata", error)
        }
        const ttl = error instanceof CustomerAccountApiError && error.status === 429
          ? METADATA_ERROR_TTL_MS
          : METADATA_TTL_MS
        return createMetadata(undefined, ttl)
      })
      .then((metadata) => {
        metadataCache = metadata
        return metadata
      })
      .finally(() => {
        metadataPromise = null
      })
  }

  return metadataPromise
}

type GraphQLResponse<T> = {
  data?: T
  errors?: unknown
}

type GraphQLVariables = Record<string, unknown>

function sanitizeVariables(variables?: GraphQLVariables) {
  if (!variables) return undefined
  const sanitized: GraphQLVariables = {}
  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined) continue
    sanitized[key] = value
  }
  return sanitized
}

function normalizeGraphqlErrors(errors: unknown, rawBody: string) {
  if (!errors) return [] as string[]

  const normalized: string[] = []
  if (Array.isArray(errors)) {
    for (const error of errors) {
      if (typeof error === "string" && error.trim().length) {
        normalized.push(error)
      } else if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message?: unknown }).message
        if (typeof message === "string" && message.trim().length) {
          normalized.push(message)
        }
      }
    }
  } else if (typeof errors === "string" && errors.trim().length) {
    normalized.push(errors)
  } else if (errors && typeof errors === "object" && "message" in errors) {
    const message = (errors as { message?: unknown }).message
    if (typeof message === "string" && message.trim().length) {
      normalized.push(message)
    }
  }

  if (!normalized.length && rawBody.trim().length) {
    normalized.push(rawBody.trim())
  }

  return normalized
}

async function executeGraphql<T>(
  metadata: CustomerAccountMetadata,
  accessToken: string,
  query: string,
  variables?: GraphQLVariables,
) {
  let response: Response
  try {
    response = await fetch(metadata.graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables: sanitizeVariables(variables) }),
    })
  } catch (error) {
    throw new CustomerAccountApiError("Unable to reach Shopify Customer Account API", {
      endpoint: metadata.graphqlEndpoint,
      cause: error,
    })
  }

  const requestId = response.headers.get("x-request-id")
  let rawBody = ""
  try {
    rawBody = await response.text()
  } catch (error) {
    throw new CustomerAccountApiError("Unable to read Customer Account API response", {
      endpoint: metadata.graphqlEndpoint,
      status: response.status,
      requestId,
      cause: error,
    })
  }

  let payload: GraphQLResponse<T> | null = null
  if (rawBody.trim().length) {
    try {
      payload = JSON.parse(rawBody) as GraphQLResponse<T>
    } catch (error) {
      throw new CustomerAccountApiError("Customer Account API response malformed", {
        endpoint: metadata.graphqlEndpoint,
        status: response.status,
        requestId,
        body: rawBody,
        cause: error,
      })
    }
  }

  const errors = normalizeGraphqlErrors(payload?.errors, rawBody)
  if (!response.ok || errors.length) {
    const message =
      errors.length > 0
        ? errors.join("; ")
        : `Customer Account API request failed${response.status ? ` (${response.status})` : ""}`
    throw new CustomerAccountApiError(message, {
      endpoint: metadata.graphqlEndpoint,
      status: response.status,
      requestId,
      body: rawBody,
      errors,
    })
  }

  if (!payload?.data) {
    throw new CustomerAccountApiError("Customer Account API response missing data", {
      endpoint: metadata.graphqlEndpoint,
      status: response.status,
      requestId,
      body: rawBody,
    })
  }

  return payload.data
}

async function customerAccountGraphql<T>(
  accessToken: string,
  query: string,
  variables?: GraphQLVariables,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const metadata = await getCustomerAccountMetadata({ force: attempt > 0 })
    try {
      return await executeGraphql<T>(metadata, accessToken, query, variables)
    } catch (error) {
      if (error instanceof CustomerAccountApiError && error.status === 404 && attempt === 0) {
        lastError = error
        continue
      }
      throw error
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }

  throw new ShopifyError("Customer Account API request failed")
}

function formatAddress(address: AddressNode): AddressNode {
  const lines: string[] = []
  const name = [address.firstName, address.lastName]
    .filter((part): part is string => Boolean(part && part.trim().length))
    .join(" ")
    .trim()
  if (name) lines.push(name)
  if (address.address1) lines.push(address.address1)
  if (address.address2) lines.push(address.address2)
  const cityLine = [address.city, address.provinceCode ?? address.province, address.zip]
    .filter((part): part is string => Boolean(part && part.trim().length))
    .join(", ")
  if (cityLine) lines.push(cityLine)
  const country = address.countryCode ?? address.country
  if (country) lines.push(country)
  return {
    ...address,
    formatted: lines,
  }
}

function normalizeAddressConnection(connection?: AddressConnection | null): AddressConnection {
  const nodes = connection?.nodes ?? []
  return {
    pageInfo: connection?.pageInfo,
    nodes: nodes.map(formatAddress),
  }
}

function normalizeOrdersConnection(connection?: OrdersConnection | null): OrdersConnection {
  const nodes = connection?.nodes ?? []
  return {
    pageInfo: connection?.pageInfo,
    nodes: nodes.map((order) => ({
      ...order,
      lineItems: {
        nodes: order.lineItems?.nodes ?? [],
      },
    })),
  }
}

function assertNoUserErrors(errors?: GraphQLUserError[] | null) {
  const messages = (errors || [])
    .map((error) => (typeof error?.message === "string" ? error.message.trim() : ""))
    .filter((message) => message.length)
  if (messages.length) {
    throw new ShopifyError(messages.join("; "))
  }
}

function toCustomerAddressInput(address: MailingAddressInput): CustomerAddressInput {
  return {
    firstName: address.firstName ?? undefined,
    lastName: address.lastName ?? undefined,
    address1: address.address1 ?? undefined,
    address2: address.address2 ?? undefined,
    city: address.city ?? undefined,
    provinceCode: address.provinceCode ?? address.province ?? undefined,
    countryCode: address.countryCode ?? address.country ?? undefined,
    zip: address.zip ?? undefined,
    phone: address.phone ?? undefined,
    isDefault: address.isDefault ?? undefined,
  }
}

const CUSTOMER_ACCOUNT_ADDRESS_FRAGMENT = /* GraphQL */ `
  fragment CustomerAccountAddress on MailingAddress {
    id
    firstName
    lastName
    address1
    address2
    city
    province
    provinceCode
    country
    countryCode
    zip
    phone
    isDefault
  }
`

const CUSTOMER_ACCOUNT_ORDER_FRAGMENT = /* GraphQL */ `
  fragment CustomerAccountOrder on Order {
    id
    name
    orderNumber
    processedAt
    fulfillmentStatus
    currentTotalPriceSet {
      presentmentMoney {
        amount
        currencyCode
      }
    }
    lineItems(first: 10) {
      nodes {
        title
        quantity
      }
    }
  }
`

const CUSTOMER_ACCOUNT_OVERVIEW_QUERY = /* GraphQL */ `
  ${CUSTOMER_ACCOUNT_ADDRESS_FRAGMENT}
  ${CUSTOMER_ACCOUNT_ORDER_FRAGMENT}
  query CustomerAccountOverview(
    $addressesFirst: Int = 10
    $addressesAfter: String
    $ordersFirst: Int = 20
    $ordersAfter: String
  ) {
    customer {
      id
      displayName
      firstName
      lastName
      emailAddress {
        emailAddress
      }
      phone
      addresses(first: $addressesFirst, after: $addressesAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ...CustomerAccountAddress
        }
      }
      orders(first: $ordersFirst, after: $ordersAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ...CustomerAccountOrder
        }
      }
    }
  }
`

const CUSTOMER_ACCOUNT_ORDERS_QUERY = /* GraphQL */ `
  ${CUSTOMER_ACCOUNT_ORDER_FRAGMENT}
  query CustomerAccountOrders($first: Int!, $after: String) {
    customer {
      orders(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ...CustomerAccountOrder
        }
      }
    }
  }
`

const CUSTOMER_ACCOUNT_ADDRESSES_QUERY = /* GraphQL */ `
  ${CUSTOMER_ACCOUNT_ADDRESS_FRAGMENT}
  query CustomerAccountAddresses($first: Int = 20, $after: String) {
    customer {
      id
      addresses(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ...CustomerAccountAddress
        }
      }
    }
  }
`

const CUSTOMER_ACCOUNT_UPDATE_MUTATION = /* GraphQL */ `
  mutation CustomerAccountUpdate($input: CustomerUpdateInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        displayName
        firstName
        lastName
        emailAddress {
          emailAddress
        }
        phone
      }
      userErrors {
        field
        message
      }
    }
  }
`

const CUSTOMER_ACCOUNT_ADDRESS_CREATE_MUTATION = /* GraphQL */ `
  ${CUSTOMER_ACCOUNT_ADDRESS_FRAGMENT}
  mutation CustomerAccountAddressCreate($input: CustomerAddressInput!) {
    customerAddressCreate(input: $input) {
      customerAddress {
        ...CustomerAccountAddress
      }
      userErrors {
        field
        message
      }
    }
  }
`

const CUSTOMER_ACCOUNT_ADDRESS_UPDATE_MUTATION = /* GraphQL */ `
  ${CUSTOMER_ACCOUNT_ADDRESS_FRAGMENT}
  mutation CustomerAccountAddressUpdate($id: ID!, $input: CustomerAddressInput!) {
    customerAddressUpdate(id: $id, input: $input) {
      customerAddress {
        ...CustomerAccountAddress
      }
      userErrors {
        field
        message
      }
    }
  }
`

const CUSTOMER_ACCOUNT_ADDRESS_DELETE_MUTATION = /* GraphQL */ `
  mutation CustomerAccountAddressDelete($id: ID!) {
    customerAddressDelete(id: $id) {
      deletedCustomerAddressId
      userErrors {
        field
        message
      }
    }
  }
`

const CUSTOMER_ACCOUNT_ADDRESS_SET_DEFAULT_MUTATION = /* GraphQL */ `
  ${CUSTOMER_ACCOUNT_ADDRESS_FRAGMENT}
  mutation CustomerAccountAddressSetDefault($id: ID!) {
    customerDefaultAddressUpdate(addressId: $id) {
      customer {
        defaultAddress {
          ...CustomerAccountAddress
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

type RawCustomerOverviewResult = {
  customer?: {
    id: string
    displayName?: string | null
    firstName?: string | null
    lastName?: string | null
    emailAddress?: { emailAddress?: string | null } | null
    phone?: string | null
    addresses?: AddressConnection | null
    orders?: OrdersConnection | null
  } | null
}

type RawCustomerOrdersResult = {
  customer?: {
    orders?: OrdersConnection | null
  } | null
}

type RawCustomerAddressesResult = {
  customer?: {
    id: string
    addresses?: AddressConnection | null
  } | null
}

export async function getCustomerAccountPortalUrl() {
  const metadata = await getCustomerAccountMetadata()
  return metadata.accountManagementUrl ?? metadata.accountPortalUrl ?? null
}

export async function getCustomerAccountOverview(accessToken: string): Promise<CustomerOverviewResult> {
  const result = await callShopify(() =>
    customerAccountGraphql<RawCustomerOverviewResult>(accessToken, CUSTOMER_ACCOUNT_OVERVIEW_QUERY, {
      addressesFirst: 10,
      ordersFirst: 20,
    }),
  )

  if (!result.customer) {
    throw new ShopifyError("Customer not found")
  }

  const addressesConnection = normalizeAddressConnection(result.customer.addresses)
  const ordersConnection = normalizeOrdersConnection(result.customer.orders)
  const portal = await getCustomerAccountPortalUrl()

  return {
    customer: {
      ...result.customer,
      addresses: addressesConnection.nodes,
      addressesConnection,
      orders: ordersConnection,
    },
    customerAccountUrl: portal,
  }
}

export async function getCustomerOrders(
  accessToken: string,
  variables: { first: number; after?: string | null },
): Promise<CustomerOrdersResult> {
  const result = await callShopify(() =>
    customerAccountGraphql<RawCustomerOrdersResult>(accessToken, CUSTOMER_ACCOUNT_ORDERS_QUERY, {
      first: variables.first,
      after: variables.after ?? undefined,
    }),
  )

  if (!result.customer) {
    throw new ShopifyError("Customer not found")
  }

  const ordersConnection = normalizeOrdersConnection(result.customer.orders)

  return {
    customer: {
      ...result.customer,
      orders: ordersConnection,
    },
  }
}

export async function getCustomerAddresses(accessToken: string, options?: { first?: number; after?: string | null }) {
  const result = await callShopify(() =>
    customerAccountGraphql<RawCustomerAddressesResult>(accessToken, CUSTOMER_ACCOUNT_ADDRESSES_QUERY, {
      first: options?.first ?? 50,
      after: options?.after ?? undefined,
    }),
  )

  if (!result.customer) {
    throw new ShopifyError("Customer not found")
  }

  const addressesConnection = normalizeAddressConnection(result.customer.addresses)

  const payload: CustomerAddressesResult = {
    customer: {
      id: result.customer.id,
      addresses: addressesConnection.nodes,
      addressesConnection,
    },
  }

  return payload
}

export async function updateCustomerProfile(accessToken: string, input: CustomerUpdateInput) {
  const variables: Record<string, unknown> = {}
  if (input.email !== undefined) variables.email = input.email
  if (input.firstName !== undefined) variables.firstName = input.firstName
  if (input.lastName !== undefined) variables.lastName = input.lastName
  if (input.phone !== undefined) variables.phone = input.phone

  const result = await callShopify(() =>
    customerAccountGraphql<CustomerUpdateResult>(accessToken, CUSTOMER_ACCOUNT_UPDATE_MUTATION, {
      input: variables,
    }),
  )

  const payload = result.customerUpdate
  if (!payload) {
    throw new ShopifyError("Unable to update profile")
  }

  assertNoUserErrors(payload.userErrors)
  return payload.customer ?? null
}

export async function createCustomerAddress(accessToken: string, address: MailingAddressInput) {
  const result = await callShopify(() =>
    customerAccountGraphql<CustomerAddressCreateResult>(accessToken, CUSTOMER_ACCOUNT_ADDRESS_CREATE_MUTATION, {
      input: toCustomerAddressInput(address),
    }),
  )

  const payload = result.customerAddressCreate
  if (!payload) {
    throw new ShopifyError("Unable to create address")
  }

  assertNoUserErrors(payload.userErrors)
  return payload.customerAddress ? formatAddress(payload.customerAddress) : null
}

export async function updateCustomerAddress(accessToken: string, id: string, address: MailingAddressInput) {
  const result = await callShopify(() =>
    customerAccountGraphql<CustomerAddressUpdateResult>(accessToken, CUSTOMER_ACCOUNT_ADDRESS_UPDATE_MUTATION, {
      id,
      input: toCustomerAddressInput(address),
    }),
  )

  const payload = result.customerAddressUpdate
  if (!payload) {
    throw new ShopifyError("Unable to update address")
  }

  assertNoUserErrors(payload.userErrors)
  return payload.customerAddress ? formatAddress(payload.customerAddress) : null
}

export async function deleteCustomerAddress(accessToken: string, id: string) {
  const result = await callShopify(() =>
    customerAccountGraphql<CustomerAddressDeleteResult>(accessToken, CUSTOMER_ACCOUNT_ADDRESS_DELETE_MUTATION, {
      id,
    }),
  )

  const payload = result.customerAddressDelete
  if (!payload) {
    throw new ShopifyError("Unable to delete address")
  }

  assertNoUserErrors(payload.userErrors)
  return payload.deletedCustomerAddressId ?? null
}

export async function setDefaultCustomerAddress(accessToken: string, addressId: string) {
  const result = await callShopify(() =>
    customerAccountGraphql<CustomerDefaultAddressUpdateResult>(
      accessToken,
      CUSTOMER_ACCOUNT_ADDRESS_SET_DEFAULT_MUTATION,
      { id: addressId },
    ),
  )

  const payload = result.customerDefaultAddressUpdate
  if (!payload) {
    throw new ShopifyError("Unable to update default address")
  }

  assertNoUserErrors(payload.userErrors)
  const defaultAddress = payload.customer?.defaultAddress
  return defaultAddress ? formatAddress({ ...defaultAddress, isDefault: true }) : null
}
