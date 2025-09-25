import type { MoneyV2 } from "@/lib/shopify/money"

export type GraphQLUserError = {
  field?: (string | null)[] | null
  message?: string | null
}

export type CustomerEmailAddress = {
  emailAddress?: string | null
}

export type AddressNode = {
  id: string
  firstName?: string | null
  lastName?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  provinceCode?: string | null
  zip?: string | null
  country?: string | null
  countryCode?: string | null
  phone?: string | null
  isDefault?: boolean | null
  formatted?: string[]
}

export type OrderLineItemNode = {
  title?: string | null
  quantity?: number | null
}

export type OrderNode = {
  id: string
  name?: string | null
  orderNumber?: number | null
  processedAt?: string | null
  fulfillmentStatus?: string | null
  currentTotalPriceSet?: {
    presentmentMoney?: MoneyV2 | null
  } | null
  lineItems?: {
    nodes: OrderLineItemNode[]
  } | null
}

export type OrdersConnection = {
  pageInfo?: {
    hasNextPage?: boolean | null
    endCursor?: string | null
  } | null
  nodes: OrderNode[]
}

export type CustomerNode = {
  id: string
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  emailAddress?: CustomerEmailAddress | null
  phone?: string | null
  addresses?: AddressNode[] | null
  orders?: OrdersConnection | null
}

export type CustomerOverviewResult = {
  customer?: CustomerNode | null
  customerAccountUrl?: string | null
}

export type CustomerOrdersResult = {
  customer?: {
    orders?: OrdersConnection | null
  } | null
}

export type CustomerAddressesResult = {
  customer?: {
    id: string
    addresses?: AddressNode[] | null
  } | null
}

export type MailingAddressInput = {
  firstName?: string | null
  lastName?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  provinceCode?: string | null
  zip?: string | null
  country?: string | null
  countryCode?: string | null
  phone?: string | null
  isDefault?: boolean | null
}

export type CustomerUpdateInput = {
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}

export type CustomerAddressInput = {
  firstName?: string | null
  lastName?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  provinceCode?: string | null
  countryCode?: string | null
  zip?: string | null
  phone?: string | null
  isDefault?: boolean | null
}
