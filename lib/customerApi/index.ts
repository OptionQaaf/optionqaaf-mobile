import { postGraphQL, CustomerApiError, InvalidTokenError, PermissionError, ThrottledError } from "./client"
import {
  CUSTOMER_ADDRESS_CREATE_MUTATION,
  CUSTOMER_ADDRESS_DELETE_MUTATION,
  CUSTOMER_ADDRESS_UPDATE_MUTATION,
  CUSTOMER_DEFAULT_ADDRESS_MUTATION,
  CUSTOMER_ME_QUERY,
  CUSTOMER_UPDATE_MUTATION,
} from "./operations"
import type { Address, Customer, UserError, Order } from "./types"

export class ValidationError extends CustomerApiError {
  userErrors: UserError[]

  constructor(message: string, endpoint: string, userErrors: UserError[]) {
    super(message, endpoint, 400, userErrors)
    this.name = "ValidationError"
    this.userErrors = userErrors
  }
}

type CustomerPayload<T> = T & {
  userErrors?: UserError[] | null
}

function assertNoUserErrors<T extends { userErrors?: UserError[] | null }>(
  result: T,
  endpoint: string,
  context: string,
): T {
  const errors = Array.isArray(result.userErrors) ? (result.userErrors as UserError[]).filter(Boolean) : []
  if (errors.length > 0) {
    throw new ValidationError(`${context} failed`, endpoint, errors)
  }
  return result
}

export async function getMe(): Promise<Customer> {
  const data = await postGraphQL<{ customer: Customer | null }>(CUSTOMER_ME_QUERY)
  if (!data.customer) {
    throw new InvalidTokenError("Customer session expired", "CustomerMe")
  }
  return data.customer
}

export async function updateProfile(input: Record<string, unknown>): Promise<Customer> {
  const result = await postGraphQL<{
    customerUpdate: CustomerPayload<{ customer: Customer | null }>
  }>(CUSTOMER_UPDATE_MUTATION, { input })

  assertNoUserErrors(result.customerUpdate, "CustomerUpdate", "Profile update")
  return getMe()
}

export async function createAddress(input: Record<string, unknown>): Promise<Customer> {
  const result = await postGraphQL<{
    customerAddressCreate: CustomerPayload<{ customer: Customer | null; customerAddress: Address | null }>
  }>(CUSTOMER_ADDRESS_CREATE_MUTATION, { input })

  assertNoUserErrors(result.customerAddressCreate, "CustomerAddressCreate", "Address create")
  return getMe()
}

export async function updateAddress(id: string, input: Record<string, unknown>): Promise<Customer> {
  const result = await postGraphQL<{
    customerAddressUpdate: CustomerPayload<{ customer: Customer | null; customerAddress: Address | null }>
  }>(CUSTOMER_ADDRESS_UPDATE_MUTATION, { id, input })

  assertNoUserErrors(result.customerAddressUpdate, "CustomerAddressUpdate", "Address update")
  return getMe()
}

export async function deleteAddress(id: string): Promise<Customer> {
  const result = await postGraphQL<{
    customerAddressDelete: CustomerPayload<{ customer: Customer | null; deletedCustomerAddressId?: string | null }>
  }>(CUSTOMER_ADDRESS_DELETE_MUTATION, { id })

  assertNoUserErrors(result.customerAddressDelete, "CustomerAddressDelete", "Address delete")
  return getMe()
}

export async function setDefaultAddress(id: string): Promise<Customer> {
  const result = await postGraphQL<{
    customerDefaultAddressUpdate: CustomerPayload<{ customer: Customer | null }>
  }>(CUSTOMER_DEFAULT_ADDRESS_MUTATION, { addressId: id })

  assertNoUserErrors(result.customerDefaultAddressUpdate, "CustomerDefaultAddressUpdate", "Set default address")
  return getMe()
}

export { CustomerApiError, InvalidTokenError, PermissionError, ThrottledError }
export type { Customer, Address, Order, UserError }
