import { customerGraphQL } from "@/lib/shopify/customer/client"
import { fetchCustomerProfile, type CustomerProfile } from "@/lib/shopify/customer/profile"

const CUSTOMER_ADDRESS_CREATE_MUTATION = /* GraphQL */ `
  mutation CustomerAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) {
    customerAddressCreate(address: $address, defaultAddress: $defaultAddress) {
      customerAddress {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`

const CUSTOMER_ADDRESS_UPDATE_MUTATION = /* GraphQL */ `
  mutation CustomerAddressUpdate(
    $addressId: ID!
    $address: CustomerAddressInput
    $defaultAddress: Boolean
  ) {
    customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) {
      customerAddress {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`

const CUSTOMER_ADDRESS_DELETE_MUTATION = /* GraphQL */ `
  mutation CustomerAddressDelete($addressId: ID!) {
    customerAddressDelete(addressId: $addressId) {
      deletedAddressId
      userErrors {
        field
        message
      }
    }
  }
`

const CUSTOMER_DEFAULT_ADDRESS_UPDATE_MUTATION = /* GraphQL */ `
  mutation CustomerDefaultAddressUpdate($addressId: ID!) {
    customerDefaultAddressUpdate(addressId: $addressId) {
      customerAddress {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`

type UserError = { field?: string[] | null; message?: string | null }

type CustomerAddressPayload = { userErrors?: (UserError | null)[] | null }

type CustomerAddressCreateResult = {
  customerAddressCreate?: (CustomerAddressPayload & { customerAddress?: { id: string } | null }) | null
}

type CustomerAddressUpdateResult = {
  customerAddressUpdate?: (CustomerAddressPayload & { customerAddress?: { id: string } | null }) | null
}

type CustomerAddressDeleteResult = {
  customerAddressDelete?: (CustomerAddressPayload & { deletedAddressId?: string | null }) | null
}

type CustomerDefaultAddressUpdateResult = {
  customerDefaultAddressUpdate?: (CustomerAddressPayload & { customerAddress?: { id: string } | null }) | null
}

export type CustomerAddressInput = {
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  phoneNumber?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  zip?: string | null
  zoneCode?: string | null
  territoryCode?: string | null
  country?: string | null
}

function extractErrors(payload: CustomerAddressPayload | null | undefined): string[] {
  return (
    payload?.userErrors
      ?.map((err) => err?.message?.trim())
      .filter((msg): msg is string => !!msg && msg.length > 0) ?? []
  )
}

export async function createCustomerAddress(
  address: CustomerAddressInput,
  options: { defaultAddress?: boolean; addressLimit?: number } = {},
): Promise<CustomerProfile> {
  const { defaultAddress, addressLimit = 6 } = options
  const result = await customerGraphQL<CustomerAddressCreateResult>(CUSTOMER_ADDRESS_CREATE_MUTATION, {
    address,
    defaultAddress,
  })

  const errors = extractErrors(result?.customerAddressCreate)
  if (errors.length) {
    throw new Error(errors.join("; "))
  }

  return fetchCustomerProfile(addressLimit)
}

export async function updateCustomerAddress(
  addressId: string,
  address: CustomerAddressInput,
  options: { defaultAddress?: boolean; addressLimit?: number } = {},
): Promise<CustomerProfile> {
  const { defaultAddress, addressLimit = 6 } = options
  const result = await customerGraphQL<CustomerAddressUpdateResult>(CUSTOMER_ADDRESS_UPDATE_MUTATION, {
    addressId,
    address,
    defaultAddress,
  })

  const errors = extractErrors(result?.customerAddressUpdate)
  if (errors.length) {
    throw new Error(errors.join("; "))
  }

  return fetchCustomerProfile(addressLimit)
}

export async function deleteCustomerAddress(
  addressId: string,
  addressLimit = 6,
): Promise<CustomerProfile> {
  const result = await customerGraphQL<CustomerAddressDeleteResult>(CUSTOMER_ADDRESS_DELETE_MUTATION, {
    addressId,
  })

  const errors = extractErrors(result?.customerAddressDelete)
  if (errors.length) {
    throw new Error(errors.join("; "))
  }

  return fetchCustomerProfile(addressLimit)
}

export async function setDefaultCustomerAddress(addressId: string, addressLimit = 6): Promise<CustomerProfile> {
  const result = await customerGraphQL<CustomerDefaultAddressUpdateResult>(
    CUSTOMER_DEFAULT_ADDRESS_UPDATE_MUTATION,
    {
      addressId,
    },
  )

  const errors = extractErrors(result?.customerDefaultAddressUpdate)
  if (errors.length) {
    throw new Error(errors.join("; "))
  }

  return fetchCustomerProfile(addressLimit)
}
