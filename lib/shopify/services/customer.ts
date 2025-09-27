import { ShopifyError, callShopify } from "@/lib/shopify/client"
import { SHOPIFY_API_VERSION, SHOPIFY_DOMAIN } from "@/lib/shopify/env"
import type {
  AddressNode,
  CustomerAddressesResult,
  CustomerOverviewResult,
  CustomerOrdersResult,
  CustomerUpdateInput,
  GraphQLUserError,
  MailingAddressInput,
  OrderNode,
} from "@/lib/shopify/types/customer"

function sanitizeDomain(domain: string) {
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

const SHOP_DOMAIN = sanitizeDomain(SHOPIFY_DOMAIN)

function normalizeGraphqlEndpoint(endpoint: string | undefined | null) {
  if (!endpoint) return undefined
  const sanitized = endpoint.replace(/\/?$/, "")
  if (sanitized.endsWith("/graphql")) return `${sanitized}.json`
  return sanitized
}

const DEFAULT_GRAPHQL_ENDPOINT_BASE = `https://${SHOP_DOMAIN}/customer-account/api/${SHOPIFY_API_VERSION}/graphql`
// Shopify expects Customer Account GraphQL requests to target the `.json` endpoint
// (see https://shopify.dev/docs/api/customer#authentication).
const DEFAULT_GRAPHQL_ENDPOINT = normalizeGraphqlEndpoint(DEFAULT_GRAPHQL_ENDPOINT_BASE)!
const WELL_KNOWN_URL = `https://${SHOP_DOMAIN}/.well-known/customer-account-api`
const DEFAULT_PORTAL_URL = `https://${SHOP_DOMAIN}/account`

type CustomerAccountMetadata = {
  graphqlEndpoint: string
  accountPortalUrl?: string | null
  accountManagementUrl?: string | null
}

type WellKnownResponse = {
  graphql_api?: string
  account_url?: string | null
  account_management_url?: string | null
}

type GraphQLResponse<T> = {
  data?: T
  errors?: unknown
}

type CustomerUpdateMutationPayload = {
  customerUpdate?: {
    customer?: CustomerOverviewResult["customer"]
    userErrors?: GraphQLUserError[] | null
  } | null
}

class CustomerAccountApiError extends ShopifyError {
  constructor(message: string, public status?: number, public body?: string, public endpoint?: string) {
    super(message)
    this.name = "CustomerAccountApiError"
  }
}

let metadataCache: CustomerAccountMetadata | null = null
let metadataPromise: Promise<CustomerAccountMetadata> | null = null

async function loadCustomerAccountMetadata(): Promise<CustomerAccountMetadata> {
  try {
    const response = await fetch(WELL_KNOWN_URL, {
      headers: { Accept: "application/json" },
    })
    if (!response.ok) {
      throw new ShopifyError(`Failed to load customer metadata (${response.status})`)
    }
    const payload = (await response.json()) as WellKnownResponse
    return {
      graphqlEndpoint: normalizeGraphqlEndpoint(payload.graphql_api) || DEFAULT_GRAPHQL_ENDPOINT,
      accountPortalUrl: payload.account_management_url ?? payload.account_url ?? DEFAULT_PORTAL_URL,
      accountManagementUrl: payload.account_management_url ?? null,
    }
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[Shopify] Unable to resolve Customer Account metadata", error)
    }
    return {
      graphqlEndpoint: DEFAULT_GRAPHQL_ENDPOINT,
      accountPortalUrl: DEFAULT_PORTAL_URL,
      accountManagementUrl: null,
    }
  }
}

async function getCustomerAccountMetadata(options?: { refresh?: boolean }) {
  if (options?.refresh) {
    metadataCache = null
    metadataPromise = null
  }
  if (metadataCache) return metadataCache
  if (!metadataPromise) {
    metadataPromise = loadCustomerAccountMetadata()
      .then((meta) => {
        metadataCache = meta
        return meta
      })
      .finally(() => {
        metadataPromise = null
      })
  }
  return metadataPromise
}

function prepareVariables(variables?: Record<string, unknown>) {
  if (!variables) return undefined
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined) continue
    sanitized[key] = value
  }
  return sanitized
}

function normalizeGraphqlErrors(errors: unknown, rawBody: string) {
  if (!errors) return [] as string[]

  if (Array.isArray(errors)) {
    const messages = errors
      .map((error) => {
        if (typeof error === "string") return error
        if (error && typeof error === "object" && "message" in error) {
          const message = (error as { message?: unknown }).message
          if (typeof message === "string") return message
        }
        return undefined
      })
      .filter((message): message is string => Boolean(message && message.length))

    if (messages.length) return messages
  }

  if (typeof errors === "string" && errors.length) {
    return [errors]
  }

  if (errors && typeof errors === "object" && "message" in errors) {
    const message = (errors as { message?: unknown }).message
    if (typeof message === "string" && message.length) {
      return [message]
    }
  }

  const fallback = rawBody?.trim()
  return fallback ? [fallback] : []
}

async function executeCustomerAccountGraphql<T>(
  endpoint: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
) {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables: prepareVariables(variables) }),
    })
  } catch (error) {
    throw new ShopifyError("Unable to reach Shopify Customer Account API", error)
  }

  let rawBody = ""
  try {
    rawBody = await response.text()
  } catch (error) {
    throw new ShopifyError("Unable to read Customer Account API response", error)
  }

  let payload: GraphQLResponse<T>
  try {
    payload = rawBody ? (JSON.parse(rawBody) as GraphQLResponse<T>) : ({} as GraphQLResponse<T>)
  } catch (error) {
    throw new ShopifyError(rawBody || "Customer Account API response malformed", error)
  }

  const graphQLErrors = normalizeGraphqlErrors(payload.errors, rawBody)
  if (!response.ok || graphQLErrors.length) {
    const message = graphQLErrors.join("; ") || `Customer Account API request failed${response.status ? ` (${response.status})` : ""}`
    throw new CustomerAccountApiError(message, response.status, rawBody, endpoint)
  }

  if (!payload.data) {
    throw new ShopifyError("Customer Account API response missing data")
  }

  return payload.data
}

async function customerAccountRequest<T>(accessToken: string, query: string, variables?: Record<string, unknown>) {
  let lastError: unknown
  for (const refresh of [false, true]) {
    const metadata = await getCustomerAccountMetadata({ refresh })
    try {
      return await executeCustomerAccountGraphql<T>(metadata.graphqlEndpoint, accessToken, query, variables)
    } catch (error) {
      if (error instanceof CustomerAccountApiError && error.status === 404 && !refresh) {
        lastError = error
        continue
      }
      throw error
    }
  }
  if (lastError instanceof Error) throw lastError
  throw new ShopifyError("Customer Account API request failed")
}

export async function getCustomerAccountPortalUrl() {
  const metadata = await getCustomerAccountMetadata()
  return metadata.accountManagementUrl ?? metadata.accountPortalUrl ?? null
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

function normalizeOrder(order: OrderNode): OrderNode {
  return {
    ...order,
    lineItems: {
      nodes: order.lineItems?.nodes ?? [],
    },
  }
}

function assertNoUserErrors(errors?: GraphQLUserError[] | null) {
  const messages = (errors || [])
    .map((error) => error?.message)
    .filter((message): message is string => Boolean(message && message.length))
  if (messages.length) {
    throw new ShopifyError(messages.join("; "))
  }
}

function toCustomerAddressInput(address: MailingAddressInput) {
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

// Keep the Customer Account API document strings in sync with
// lib/shopify/queries/customerAccount.graphql so tooling and codegen remain accurate.
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
  query CustomerAccountOverview($ordersFirst: Int = 20, $ordersAfter: String) {
    customer {
      id
      displayName
      firstName
      lastName
      emailAddress {
        emailAddress
      }
      phone
      addresses {
        ...CustomerAccountAddress
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
  query CustomerAccountAddresses {
    customer {
      id
      addresses {
        ...CustomerAccountAddress
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
    customerAddressUpdate(id: $id, input: { isDefault: true }) {
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

export async function getCustomerAccountOverview(
  accessToken: string,
  options?: { ordersFirst?: number; ordersAfter?: string | null },
) {
  const result = await callShopify(() =>
    customerAccountRequest<CustomerOverviewResult>(accessToken, CUSTOMER_ACCOUNT_OVERVIEW_QUERY, {
      ordersFirst: options?.ordersFirst ?? 20,
      ordersAfter: options?.ordersAfter ?? undefined,
    }),
  )

  if (!result.customer) {
    throw new ShopifyError("Customer not found")
  }

  const addresses = (result.customer.addresses ?? []).map(formatAddress)
  const ordersConnection = result.customer.orders
  const orders = ordersConnection
    ? {
        ...ordersConnection,
        nodes: (ordersConnection.nodes ?? []).map(normalizeOrder),
      }
    : { nodes: [] as OrderNode[], pageInfo: undefined }

  const portal = await getCustomerAccountPortalUrl()

  return {
    customer: {
      ...result.customer,
      addresses,
      orders,
    },
    customerAccountUrl: portal,
  }
}

export async function getCustomerOrders(accessToken: string, variables: { first: number; after?: string | null }) {
  const result = await callShopify(() =>
    customerAccountRequest<CustomerOrdersResult>(accessToken, CUSTOMER_ACCOUNT_ORDERS_QUERY, {
      first: variables.first,
      after: variables.after ?? undefined,
    }),
  )

  if (!result.customer) {
    throw new ShopifyError("Customer not found")
  }

  const ordersConnection = result.customer.orders
  const nodes = ordersConnection?.nodes ?? []

  return {
    customer: {
      ...result.customer,
      orders: {
        nodes: nodes.map(normalizeOrder),
        pageInfo: ordersConnection?.pageInfo,
      },
    },
  }
}

export async function getCustomerAddresses(accessToken: string) {
  const result = await callShopify(() =>
    customerAccountRequest<CustomerAddressesResult>(accessToken, CUSTOMER_ACCOUNT_ADDRESSES_QUERY),
  )

  if (!result.customer) {
    throw new ShopifyError("Customer not found")
  }

  return {
    customer: {
      ...result.customer,
      addresses: (result.customer.addresses ?? []).map(formatAddress),
    },
  }
}

export async function updateCustomerProfile(accessToken: string, input: CustomerUpdateInput) {
  const payloadInput: Record<string, unknown> = {}
  if (input.email !== undefined) payloadInput.email = input.email
  if (input.firstName !== undefined) payloadInput.firstName = input.firstName
  if (input.lastName !== undefined) payloadInput.lastName = input.lastName
  if (input.phone !== undefined) payloadInput.phone = input.phone

  const result = await callShopify(() =>
    customerAccountRequest<CustomerUpdateMutationPayload>(accessToken, CUSTOMER_ACCOUNT_UPDATE_MUTATION, {
      input: payloadInput,
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
    customerAccountRequest<{
      customerAddressCreate?: { customerAddress?: AddressNode | null; userErrors?: GraphQLUserError[] | null }
    }>(accessToken, CUSTOMER_ACCOUNT_ADDRESS_CREATE_MUTATION, { input: toCustomerAddressInput(address) }),
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
    customerAccountRequest<{
      customerAddressUpdate?: { customerAddress?: AddressNode | null; userErrors?: GraphQLUserError[] | null }
    }>(accessToken, CUSTOMER_ACCOUNT_ADDRESS_UPDATE_MUTATION, { id, input: toCustomerAddressInput(address) }),
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
    customerAccountRequest<{
      customerAddressDelete?: { deletedCustomerAddressId?: string | null; userErrors?: GraphQLUserError[] | null }
    }>(accessToken, CUSTOMER_ACCOUNT_ADDRESS_DELETE_MUTATION, { id }),
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
    customerAccountRequest<{
      customerAddressUpdate?: { customerAddress?: AddressNode | null; userErrors?: GraphQLUserError[] | null }
    }>(accessToken, CUSTOMER_ACCOUNT_ADDRESS_SET_DEFAULT_MUTATION, { id: addressId }),
  )

  const payload = result.customerAddressUpdate
  if (!payload) {
    throw new ShopifyError("Unable to update default address")
  }

  assertNoUserErrors(payload.userErrors)
  return payload.customerAddress ? formatAddress(payload.customerAddress) : null
}
