import { callShopify, ShopifyError, shopifyClient } from "@/lib/shopify/client"
import {
  type AddressNode,
  type CustomerAccountOverviewResult,
  type CustomerAddressesResult,
  type CustomerOrdersResult,
  type CustomerUpdateInput,
  type MailingAddressInput,
} from "@/lib/shopify/types/customer"
import { gql } from "graphql-tag"

type CustomerMutationPayload = { customerUserErrors?: { message?: string | null }[] | null }

type CustomerUpdateResponse = CustomerMutationPayload & {
  customer?: {
    id: string
    firstName?: string | null
    lastName?: string | null
    displayName?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

type CustomerAddressResponse = CustomerMutationPayload & {
  customerAddress?: AddressNode | null
  deletedCustomerAddressId?: string | null
  customer?: { defaultAddress?: { id?: string | null } | null } | null
}

const CUSTOMER_ACCOUNT_OVERVIEW = gql`
  query CustomerAccountOverview(
    $customerAccessToken: String!
    $ordersFirst: Int = 5
    $orderLineItemsFirst: Int = 4
    $addressesFirst: Int = 6
  ) {
    customer(customerAccessToken: $customerAccessToken) {
      id
      firstName
      lastName
      displayName
      email
      phone
      createdAt
      defaultAddress {
        id
        firstName
        lastName
        address1
        address2
        city
        province
        zip
        country
        phone
        formatted
      }
      addresses(first: $addressesFirst) {
        nodes {
          id
          firstName
          lastName
          address1
          address2
          city
          province
          zip
          country
          phone
          formatted
        }
      }
      orders(first: $ordersFirst, reverse: true) {
        edges {
          cursor
          node {
            id
            name
            orderNumber
            processedAt
            fulfillmentStatus
            financialStatus
            statusUrl
            currentTotalPrice {
              amount
              currencyCode
            }
            lineItems(first: $orderLineItemsFirst) {
              nodes {
                id
                quantity
                title
                variant {
                  id
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    shop {
      customerAccountUrl
    }
  }
`

const CUSTOMER_ORDERS = gql`
  query CustomerOrders($customerAccessToken: String!, $first: Int!, $after: String, $lineItemsFirst: Int = 4) {
    customer(customerAccessToken: $customerAccessToken) {
      orders(first: $first, after: $after, reverse: true) {
        edges {
          cursor
          node {
            id
            name
            orderNumber
            processedAt
            fulfillmentStatus
            financialStatus
            statusUrl
            currentTotalPrice {
              amount
              currencyCode
            }
            lineItems(first: $lineItemsFirst) {
              nodes {
                id
                quantity
                title
                variant {
                  id
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`

const CUSTOMER_ADDRESSES = gql`
  query CustomerAddresses($customerAccessToken: String!, $first: Int!, $after: String) {
    customer(customerAccessToken: $customerAccessToken) {
      id
      defaultAddress {
        id
        firstName
        lastName
        address1
        address2
        city
        province
        zip
        country
        phone
        formatted
      }
      addresses(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            firstName
            lastName
            address1
            address2
            city
            province
            zip
            country
            phone
            formatted
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`

const CUSTOMER_UPDATE_PROFILE = gql`
  mutation CustomerUpdateProfile($customerAccessToken: String!, $customer: CustomerUpdateInput!) {
    customerUpdate(customerAccessToken: $customerAccessToken, customer: $customer) {
      customer {
        id
        firstName
        lastName
        displayName
        email
        phone
      }
      customerUserErrors {
        message
      }
    }
  }
`

const CUSTOMER_ADDRESS_CREATE = gql`
  mutation CustomerAddressCreate($customerAccessToken: String!, $address: MailingAddressInput!) {
    customerAddressCreate(customerAccessToken: $customerAccessToken, address: $address) {
      customerAddress {
        id
        firstName
        lastName
        address1
        address2
        city
        province
        zip
        country
        phone
        formatted
      }
      customerUserErrors {
        message
      }
    }
  }
`

const CUSTOMER_ADDRESS_UPDATE = gql`
  mutation CustomerAddressUpdate($customerAccessToken: String!, $id: ID!, $address: MailingAddressInput!) {
    customerAddressUpdate(customerAccessToken: $customerAccessToken, id: $id, address: $address) {
      customerAddress {
        id
        firstName
        lastName
        address1
        address2
        city
        province
        zip
        country
        phone
        formatted
      }
      customerUserErrors {
        message
      }
    }
  }
`

const CUSTOMER_ADDRESS_DELETE = gql`
  mutation CustomerAddressDelete($customerAccessToken: String!, $id: ID!) {
    customerAddressDelete(customerAccessToken: $customerAccessToken, id: $id) {
      deletedCustomerAddressId
      customerUserErrors {
        message
      }
    }
  }
`

const CUSTOMER_DEFAULT_ADDRESS = gql`
  mutation CustomerDefaultAddressUpdate($customerAccessToken: String!, $addressId: ID!) {
    customerDefaultAddressUpdate(customerAccessToken: $customerAccessToken, addressId: $addressId) {
      customer {
        defaultAddress {
          id
        }
      }
      customerUserErrors {
        message
      }
    }
  }
`

function assertNoCustomerErrors(payload: CustomerMutationPayload) {
  const errs = (payload.customerUserErrors || []).map((e) => e?.message).filter(Boolean) as string[]
  if (errs.length) throw new ShopifyError(errs.join("; "))
}

export async function getCustomerAccountOverview(
  customerAccessToken: string,
  options?: {
    ordersFirst?: number
    addressesFirst?: number
    orderLineItemsFirst?: number
  },
) {
  return callShopify<CustomerAccountOverviewResult>(async () => {
    const res = await shopifyClient.request<CustomerAccountOverviewResult>(CUSTOMER_ACCOUNT_OVERVIEW, {
      customerAccessToken,
      ordersFirst: options?.ordersFirst ?? 5,
      addressesFirst: options?.addressesFirst ?? 6,
      orderLineItemsFirst: options?.orderLineItemsFirst ?? 4,
    })
    if (!res.customer) throw new ShopifyError("Customer not found")
    return res
  })
}

export async function getCustomerOrders(
  customerAccessToken: string,
  variables: { first: number; after?: string | null; lineItemsFirst?: number },
) {
  return callShopify<CustomerOrdersResult>(async () => {
    const res = await shopifyClient.request<CustomerOrdersResult>(CUSTOMER_ORDERS, {
      customerAccessToken,
      first: variables.first,
      after: variables.after ?? undefined,
      lineItemsFirst: variables.lineItemsFirst ?? 4,
    })
    if (!res.customer) throw new ShopifyError("Customer not found")
    return res
  })
}

export async function getCustomerAddresses(
  customerAccessToken: string,
  variables: { first: number; after?: string | null },
) {
  return callShopify<CustomerAddressesResult>(async () => {
    const res = await shopifyClient.request<CustomerAddressesResult>(CUSTOMER_ADDRESSES, {
      customerAccessToken,
      first: variables.first,
      after: variables.after ?? undefined,
    })
    if (!res.customer) throw new ShopifyError("Customer not found")
    return res
  })
}

export async function updateCustomerProfile(customerAccessToken: string, customer: CustomerUpdateInput) {
  return callShopify<CustomerUpdateResponse>(async () => {
    const res = await shopifyClient.request<{ customerUpdate?: CustomerUpdateResponse | null }>(
      CUSTOMER_UPDATE_PROFILE,
      {
        customerAccessToken,
        customer,
      },
    )
    const payload = res.customerUpdate
    if (!payload) throw new ShopifyError("Unable to update profile")
    assertNoCustomerErrors(payload)
    return payload.customer
  })
}

export async function createCustomerAddress(customerAccessToken: string, address: MailingAddressInput) {
  return callShopify<AddressNode | null>(async () => {
    const res = await shopifyClient.request<{ customerAddressCreate?: CustomerAddressResponse | null }>(
      CUSTOMER_ADDRESS_CREATE,
      {
        customerAccessToken,
        address,
      },
    )
    const payload = res.customerAddressCreate
    if (!payload) throw new ShopifyError("Unable to create address")
    assertNoCustomerErrors(payload)
    return payload.customerAddress ?? null
  })
}

export async function updateCustomerAddress(customerAccessToken: string, id: string, address: MailingAddressInput) {
  return callShopify<AddressNode | null>(async () => {
    const res = await shopifyClient.request<{ customerAddressUpdate?: CustomerAddressResponse | null }>(
      CUSTOMER_ADDRESS_UPDATE,
      {
        customerAccessToken,
        id,
        address,
      },
    )
    const payload = res.customerAddressUpdate
    if (!payload) throw new ShopifyError("Unable to update address")
    assertNoCustomerErrors(payload)
    return payload.customerAddress ?? null
  })
}

export async function deleteCustomerAddress(customerAccessToken: string, id: string) {
  return callShopify<string | null>(async () => {
    const res = await shopifyClient.request<{ customerAddressDelete?: CustomerAddressResponse | null }>(
      CUSTOMER_ADDRESS_DELETE,
      {
        customerAccessToken,
        id,
      },
    )
    const payload = res.customerAddressDelete
    if (!payload) throw new ShopifyError("Unable to delete address")
    assertNoCustomerErrors(payload)
    return payload.deletedCustomerAddressId ?? null
  })
}

export async function setDefaultCustomerAddress(customerAccessToken: string, addressId: string) {
  return callShopify<string | null>(async () => {
    const res = await shopifyClient.request<{ customerDefaultAddressUpdate?: CustomerAddressResponse | null }>(
      CUSTOMER_DEFAULT_ADDRESS,
      {
        customerAccessToken,
        addressId,
      },
    )
    const payload = res.customerDefaultAddressUpdate
    if (!payload) throw new ShopifyError("Unable to update default address")
    assertNoCustomerErrors(payload)
    return payload.customer?.defaultAddress?.id ?? null
  })
}
