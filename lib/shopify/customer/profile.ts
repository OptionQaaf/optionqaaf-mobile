import { customerGraphQL } from "@/lib/shopify/customer/client"

const CUSTOMER_PROFILE_QUERY = /* GraphQL */ `
  query CustomerProfile($addressLimit: Int!) {
    customer {
      id
      displayName
      firstName
      lastName
      imageUrl
      creationDate
      tags
      emailAddress {
        emailAddress
      }
      phoneNumber {
        phoneNumber
      }
      defaultAddress {
        id
        formatted
        address1
        address2
        city
        province
        country
        zip
        firstName
        lastName
        phoneNumber
        company
        zoneCode
        territoryCode
      }
      addresses(first: $addressLimit) {
        nodes {
          id
          formatted
          address1
          address2
          city
          province
          country
          zip
          firstName
          lastName
          phoneNumber
          company
          zoneCode
          territoryCode
        }
      }
    }
  }
`

const CUSTOMER_PROFILE_UPDATE_MUTATION = /* GraphQL */ `
  mutation CustomerProfileUpdate($input: CustomerUpdateInput!, $addressLimit: Int!) {
    customerUpdate(input: $input) {
      customer {
        id
        displayName
        firstName
        lastName
        imageUrl
        creationDate
        tags
        emailAddress {
          emailAddress
        }
        phoneNumber {
          phoneNumber
        }
        defaultAddress {
          id
          formatted
          address1
          address2
          city
          province
          country
          zip
          firstName
          lastName
          phoneNumber
          company
          zoneCode
          territoryCode
        }
        addresses(first: $addressLimit) {
          nodes {
            id
            formatted
            address1
            address2
            city
            province
            country
            zip
            firstName
            lastName
            phoneNumber
            company
            zoneCode
            territoryCode
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

type CustomerProfileQueryResult = {
  customer: GraphQLCustomer | null
}

type GraphQLCustomer = {
  id: string
  displayName: string
  firstName?: string | null
  lastName?: string | null
  imageUrl?: string | null
  creationDate: string
  tags?: string[] | null
  emailAddress?: { emailAddress?: string | null } | null
  phoneNumber?: { phoneNumber?: string | null } | null
  defaultAddress?: GraphQLCustomerAddress | null
  addresses?: { nodes?: (GraphQLCustomerAddress | null)[] | null } | null
}

type GraphQLCustomerAddress = {
  id: string
  formatted?: string[] | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  country?: string | null
  zip?: string | null
  firstName?: string | null
  lastName?: string | null
  phoneNumber?: string | null
  company?: string | null
  zoneCode?: string | null
  territoryCode?: string | null
}

export type CustomerAddress = {
  id: string
  lines: string[]
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  country?: string | null
  zip?: string | null
  firstName?: string | null
  lastName?: string | null
  phoneNumber?: string | null
  company?: string | null
  zoneCode?: string | null
  territoryCode?: string | null
}

export type CustomerProfile = {
  id: string
  displayName: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  imageUrl?: string | null
  creationDate: string
  tags: string[]
  defaultAddress?: CustomerAddress | null
  addresses: CustomerAddress[]
}

function normalizeAddress(node: GraphQLCustomerAddress | null | undefined): CustomerAddress | null {
  if (!node?.id) return null
  const lines = Array.isArray(node.formatted) ? node.formatted.filter((s): s is string => typeof s === "string") : []
  return {
    id: node.id,
    lines,
    address1: node.address1 ?? null,
    address2: node.address2 ?? null,
    city: node.city ?? null,
    province: node.province ?? null,
    country: node.country ?? null,
    zip: node.zip ?? null,
    firstName: node.firstName ?? null,
    lastName: node.lastName ?? null,
    phoneNumber: node.phoneNumber ?? null,
    company: node.company ?? null,
    zoneCode: node.zoneCode ?? null,
    territoryCode: node.territoryCode ?? null,
  }
}

function normalizeCustomer(customer: GraphQLCustomer): CustomerProfile {
  const addresses =
    customer.addresses?.nodes?.map((node) => normalizeAddress(node)).filter((addr): addr is CustomerAddress => !!addr) ??
    []

  const defaultAddress = normalizeAddress(customer.defaultAddress)

  const sanitizedDisplayName = (() => {
    const display = customer.displayName || ""
    const email = customer.emailAddress?.emailAddress ?? ""
    if (display.includes("@")) {
      const [local] = display.split("@")
      if (local?.trim()) return local.trim()
    }
    if (email.includes("@")) {
      const [local] = email.split("@")
      if (local?.trim()) return local.trim()
    }
    return display || email || "Guest"
  })()

  return {
    id: customer.id,
    displayName: sanitizedDisplayName,
    firstName: customer.firstName ?? null,
    lastName: customer.lastName ?? null,
    email: customer.emailAddress?.emailAddress ?? null,
    phone: customer.phoneNumber?.phoneNumber ?? null,
    imageUrl: customer.imageUrl ?? null,
    creationDate: customer.creationDate,
    tags: Array.isArray(customer.tags) ? customer.tags.filter((t): t is string => typeof t === "string") : [],
    defaultAddress,
    addresses,
  }
}

export async function fetchCustomerProfile(addressLimit = 6): Promise<CustomerProfile> {
  const data = await customerGraphQL<CustomerProfileQueryResult>(CUSTOMER_PROFILE_QUERY, { addressLimit })
  const customer = data?.customer
  if (!customer) {
    throw new Error("Customer not found")
  }
  return normalizeCustomer(customer)
}

type CustomerProfileUpdateResult = {
  customerUpdate?: {
    customer?: GraphQLCustomer | null
    userErrors?: { field?: string[] | null; message: string }[] | null
  } | null
}

export type UpdateCustomerProfileInput = {
  firstName?: string | null
  lastName?: string | null
}

export async function updateCustomerProfile(
  input: UpdateCustomerProfileInput,
  addressLimit = 6,
): Promise<CustomerProfile> {
  const payload = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined) as [string, string | null][],
  )

  const result = await customerGraphQL<CustomerProfileUpdateResult>(CUSTOMER_PROFILE_UPDATE_MUTATION, {
    input: payload,
    addressLimit,
  })

  const errors =
    result?.customerUpdate?.userErrors?.map((err) => err?.message).filter((msg): msg is string => !!msg) ?? []
  if (errors.length) {
    throw new Error(errors.join("; "))
  }

  const customer = result?.customerUpdate?.customer
  if (customer) {
    return normalizeCustomer(customer)
  }

  // If the mutation didn't return a customer, fall back to refetching.
  return fetchCustomerProfile(addressLimit)
}
