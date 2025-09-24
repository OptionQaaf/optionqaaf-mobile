import { ShopifyError, callShopify } from "@/lib/shopify/client"
import type {
  AddressNode,
  CustomerAddressInput,
  CustomerAddressesResult,
  CustomerDashboardQuery,
  CustomerOrdersResult,
  CustomerUpdateInput,
  GraphQLUserError,
  MailingAddressInput,
  OrderNode,
} from "@/lib/shopify/types/customer"

const WELL_KNOWN_URL = "https://optionqaaf.com/.well-known/customer-account-api"

type WellKnownResponse = {
  graphql_api?: string
  account_url?: string | null
  account_management_url?: string | null
}

type GraphQLResponse<T> = {
  data?: T
  errors?: { message?: string | null }[]
}

let wellKnownCache: WellKnownResponse | null = null
let wellKnownPromise: Promise<WellKnownResponse> | null = null

async function ensureWellKnown(): Promise<WellKnownResponse> {
  if (wellKnownCache) return wellKnownCache
  if (!wellKnownPromise) {
    wellKnownPromise = (async () => {
      let response: Response
      try {
        response = await fetch(WELL_KNOWN_URL)
      } catch (err) {
        throw new ShopifyError("Unable to load Customer Account API metadata", err)
      }

      if (!response.ok) {
        const text = await response.text().catch(() => null)
        throw new ShopifyError(text || `Unable to load Customer Account API metadata (${response.status})`)
      }

      const data = (await response.json()) as WellKnownResponse
      if (!data?.graphql_api) {
        throw new ShopifyError("Customer Account API metadata missing graphql_api endpoint")
      }
      wellKnownCache = data
      return data
    })().finally(() => {
      wellKnownPromise = null
    })
  }

  return wellKnownPromise
}

async function getCustomerGraphqlEndpoint() {
  const data = await ensureWellKnown()
  if (!data.graphql_api) throw new ShopifyError("Customer Account API metadata missing graphql_api endpoint")
  return data.graphql_api
}

export async function getCustomerAccountPortalUrl() {
  try {
    const data = await ensureWellKnown()
    return data.account_management_url ?? data.account_url ?? null
  } catch {
    return null
  }
}

function sanitizeVariables<T extends Record<string, unknown> | undefined>(variables: T): T {
  if (!variables) return variables
  for (const key of Object.keys(variables)) {
    if ((variables as Record<string, unknown>)[key] === undefined) {
      delete (variables as Record<string, unknown>)[key]
    }
  }
  return variables
}

async function customerAccountRequest<T>(accessToken: string, query: string, variables?: Record<string, unknown>) {
  const endpoint = await getCustomerGraphqlEndpoint()
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables: sanitizeVariables(variables) }),
    })
  } catch (err) {
    throw new ShopifyError("Unable to reach Shopify Customer Account API", err)
  }

  let bodyText = ""
  try {
    bodyText = await response.text()
  } catch (err) {
    throw new ShopifyError("Unable to read Customer Account API response", err)
  }

  let payload: GraphQLResponse<T>
  try {
    payload = bodyText ? (JSON.parse(bodyText) as GraphQLResponse<T>) : ({} as GraphQLResponse<T>)
  } catch (err) {
    throw new ShopifyError(bodyText || "Customer Account API response malformed", err)
  }

  const graphQLErrors = payload.errors?.map((err) => err?.message).filter(Boolean) as string[] | undefined
  if (!response.ok || (graphQLErrors && graphQLErrors.length)) {
    const fallbackMessage = `Customer Account API request failed${response.status ? ` (${response.status})` : ""}`
    throw new ShopifyError(graphQLErrors?.join("; ") || fallbackMessage)
  }

  if (!payload.data) throw new ShopifyError("Customer Account API response missing data")
  return payload.data
}

function handleUserErrors(errors?: GraphQLUserError[] | null) {
  const messages = (errors || [])
    .map((err) => err?.message)
    .filter((message): message is string => Boolean(message))
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

function appendFormattedAddress(address: AddressNode): AddressNode {
  const lines: string[] = []
  const name = [address.firstName, address.lastName].filter(Boolean).join(" ")
  if (name) lines.push(name)
  if (address.address1) lines.push(address.address1)
  if (address.address2) lines.push(address.address2)

  const cityLine = [address.city, address.provinceCode ?? address.province, address.zip].filter(Boolean).join(", ")
  if (cityLine) lines.push(cityLine)

  const country = address.countryCode ?? address.country
  if (country) {
    lines.push(country)
  }

  return {
    ...address,
    formatted: lines,
  }
}

const CUSTOMER_DASHBOARD_QUERY = /* GraphQL */ `
  query CustomerDashboard($ordersFirst: Int = 20, $ordersAfter: String) {
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
        id
        firstName
        lastName
        address1
        address2
        city
        provinceCode
        countryCode
        zip
        phone
        isDefault
      }
      orders(first: $ordersFirst, after: $ordersAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
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
      }
    }
  }
`

const CUSTOMER_ORDERS_QUERY = /* GraphQL */ `
  query CustomerOrders($first: Int!, $after: String) {
    customer {
      orders(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
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
      }
    }
  }
`

const CUSTOMER_ADDRESSES_QUERY = /* GraphQL */ `
  query CustomerAddresses {
    customer {
      id
      addresses {
        id
        firstName
        lastName
        address1
        address2
        city
        provinceCode
        countryCode
        zip
        phone
        isDefault
      }
    }
  }
`

const CUSTOMER_UPDATE_MUTATION = /* GraphQL */ `
  mutation UpdateCustomer($input: CustomerUpdateInput!) {
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
        message
      }
    }
  }
`

const CUSTOMER_ADDRESS_CREATE_MUTATION = /* GraphQL */ `
  mutation CreateAddress($input: CustomerAddressInput!) {
    customerAddressCreate(input: $input) {
      customerAddress {
        id
        firstName
        lastName
        address1
        address2
        city
        provinceCode
        countryCode
        zip
        phone
        isDefault
      }
      userErrors {
        message
      }
    }
  }
`

const CUSTOMER_ADDRESS_UPDATE_MUTATION = /* GraphQL */ `
  mutation UpdateAddress($id: ID!, $input: CustomerAddressInput!) {
    customerAddressUpdate(id: $id, input: $input) {
      customerAddress {
        id
        firstName
        lastName
        address1
        address2
        city
        provinceCode
        countryCode
        zip
        phone
        isDefault
      }
      userErrors {
        message
      }
    }
  }
`

const CUSTOMER_ADDRESS_DELETE_MUTATION = /* GraphQL */ `
  mutation DeleteAddress($id: ID!) {
    customerAddressDelete(id: $id) {
      deletedCustomerAddressId
      userErrors {
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
    customerAccountRequest<CustomerDashboardQuery>(accessToken, CUSTOMER_DASHBOARD_QUERY, {
      ordersFirst: options?.ordersFirst ?? 20,
      ordersAfter: options?.ordersAfter ?? undefined,
    }),
  )

  if (!result.customer) throw new ShopifyError("Customer not found")

  const addresses = (result.customer.addresses || []).map(appendFormattedAddress)
  const ordersConnection = result.customer.orders
  const normalizedOrders = ordersConnection
    ? { ...ordersConnection, nodes: ordersConnection.nodes ?? [] }
    : {
        nodes: [] as OrderNode[],
        pageInfo: undefined,
      }
  const portal = await getCustomerAccountPortalUrl()

  return {
    customer: {
      ...result.customer,
      addresses,
      orders: normalizedOrders,
    },
    customerAccountUrl: portal,
  }
}

export async function getCustomerOrders(accessToken: string, variables: { first: number; after?: string | null }) {
  const result = await callShopify(() =>
    customerAccountRequest<CustomerOrdersResult>(accessToken, CUSTOMER_ORDERS_QUERY, {
      first: variables.first,
      after: variables.after ?? undefined,
    }),
  )

  if (!result.customer) throw new ShopifyError("Customer not found")

  const ordersConnection = result.customer.orders
  const nodes = ordersConnection?.nodes ?? []

  return {
    customer: {
      ...result.customer,
      orders: {
        nodes,
        pageInfo: ordersConnection?.pageInfo,
      },
    },
  }
}

export async function getCustomerAddresses(accessToken: string) {
  const result = await callShopify(() =>
    customerAccountRequest<CustomerAddressesResult>(accessToken, CUSTOMER_ADDRESSES_QUERY),
  )

  if (!result.customer) throw new ShopifyError("Customer not found")

  return {
    customer: {
      ...result.customer,
      addresses: (result.customer.addresses || []).map(appendFormattedAddress),
    },
  }
}

export async function updateCustomerProfile(accessToken: string, input: CustomerUpdateInput) {
  const payloadInput: Record<string, unknown> = {}
  if (input.email) payloadInput.email = input.email
  if (input.firstName) payloadInput.firstName = input.firstName
  if (input.lastName) payloadInput.lastName = input.lastName
  if (input.phone) payloadInput.phone = input.phone

  const result = await callShopify(() =>
    customerAccountRequest<{ customerUpdate?: { customer?: CustomerDashboardQuery["customer"]; userErrors?: GraphQLUserError[] | null } }>(
      accessToken,
      CUSTOMER_UPDATE_MUTATION,
      { input: payloadInput },
    ),
  )

  const payload = result.customerUpdate
  if (!payload) throw new ShopifyError("Unable to update profile")
  handleUserErrors(payload.userErrors)
  return payload.customer ?? null
}

export async function createCustomerAddress(accessToken: string, address: MailingAddressInput) {
  const result = await callShopify(() =>
    customerAccountRequest<{ customerAddressCreate?: { customerAddress?: AddressNode | null; userErrors?: GraphQLUserError[] | null } }>(
      accessToken,
      CUSTOMER_ADDRESS_CREATE_MUTATION,
      { input: toCustomerAddressInput(address) },
    ),
  )

  const payload = result.customerAddressCreate
  if (!payload) throw new ShopifyError("Unable to create address")
  handleUserErrors(payload.userErrors)
  return payload.customerAddress ? appendFormattedAddress(payload.customerAddress) : null
}

export async function updateCustomerAddress(accessToken: string, id: string, address: MailingAddressInput) {
  const result = await callShopify(() =>
    customerAccountRequest<{ customerAddressUpdate?: { customerAddress?: AddressNode | null; userErrors?: GraphQLUserError[] | null } }>(
      accessToken,
      CUSTOMER_ADDRESS_UPDATE_MUTATION,
      { id, input: toCustomerAddressInput(address) },
    ),
  )

  const payload = result.customerAddressUpdate
  if (!payload) throw new ShopifyError("Unable to update address")
  handleUserErrors(payload.userErrors)
  return payload.customerAddress ? appendFormattedAddress(payload.customerAddress) : null
}

export async function deleteCustomerAddress(accessToken: string, id: string) {
  const result = await callShopify(() =>
    customerAccountRequest<{ customerAddressDelete?: { deletedCustomerAddressId?: string | null; userErrors?: GraphQLUserError[] | null } }>(
      accessToken,
      CUSTOMER_ADDRESS_DELETE_MUTATION,
      { id },
    ),
  )

  const payload = result.customerAddressDelete
  if (!payload) throw new ShopifyError("Unable to delete address")
  handleUserErrors(payload.userErrors)
  return payload.deletedCustomerAddressId ?? null
}

export async function setDefaultCustomerAddress(accessToken: string, addressId: string) {
  const result = await callShopify(() =>
    customerAccountRequest<{ customerAddressUpdate?: { customerAddress?: AddressNode | null; userErrors?: GraphQLUserError[] | null } }>(
      accessToken,
      CUSTOMER_ADDRESS_UPDATE_MUTATION,
      { id: addressId, input: { isDefault: true } },
    ),
  )

  const payload = result.customerAddressUpdate
  if (!payload) throw new ShopifyError("Unable to update default address")
  handleUserErrors(payload.userErrors)
  return payload.customerAddress ? appendFormattedAddress(payload.customerAddress) : null
}
