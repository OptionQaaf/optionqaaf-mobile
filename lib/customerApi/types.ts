export type Address = {
  id: string
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  zip?: string | null
  country?: string | null
  phone?: string | null
}

export type AddressEdge = {
  node: Address
}

export type AddressConnection = {
  edges: AddressEdge[]
}

export type MoneyV2 = {
  amount: string
  currencyCode: string
}

export type OrderLineItem = {
  id: string
  title?: string | null
  quantity: number
  price?: MoneyV2 | null
}

export type OrderLineItemEdge = {
  node: OrderLineItem
}

export type OrderLineItemConnection = {
  edges: OrderLineItemEdge[]
}

export type Order = {
  id: string
  number?: number | null
  name?: string | null
  processedAt?: string | null
  financialStatus?: string | null
  fulfillmentStatus?: string | null
  totalPrice?: MoneyV2 | null
  lineItems: OrderLineItemConnection
}

export type OrderEdge = {
  node: Order
}

export type OrderConnection = {
  edges: OrderEdge[]
}

export type Customer = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  defaultAddress?: Address | null
  addresses: AddressConnection
  orders: OrderConnection
}

export type UserError = {
  field?: string[] | null
  message: string
  code?: string | null
}
