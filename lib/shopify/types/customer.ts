export type AddressNode = {
  id: string
  firstName?: string | null
  lastName?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  zip?: string | null
  country?: string | null
  phone?: string | null
  formatted?: (string | null)[] | null
}

export type OrderLineItemNode = {
  id: string
  quantity?: number | null
  title?: string | null
  variant?: {
    id?: string | null
    image?: {
      url?: string | null
      altText?: string | null
    } | null
  } | null
}

export type OrderNode = {
  id: string
  name?: string | null
  orderNumber?: number | null
  processedAt?: string | null
  fulfillmentStatus?: string | null
  financialStatus?: string | null
  statusUrl?: string | null
  currentTotalPrice?: {
    amount?: string | null
    currencyCode?: string | null
  } | null
  lineItems?: {
    nodes: OrderLineItemNode[]
  } | null
}

export type OrderEdge = {
  cursor?: string | null
  node: OrderNode
}

export type CustomerAccountOverviewResult = {
  customer?: {
    id: string
    firstName?: string | null
    lastName?: string | null
    displayName?: string | null
    email?: string | null
    phone?: string | null
    createdAt?: string | null
    defaultAddress?: AddressNode | null
    addresses?: {
      nodes: AddressNode[]
    } | null
    orders?: {
      edges: OrderEdge[]
      pageInfo?: {
        hasNextPage?: boolean | null
        endCursor?: string | null
      } | null
    } | null
  } | null
  shop?: {
    customerAccountUrl?: string | null
  } | null
}

export type CustomerOrdersResult = {
  customer?: {
    orders?: {
      edges: OrderEdge[]
      pageInfo?: {
        hasNextPage?: boolean | null
        endCursor?: string | null
      } | null
    } | null
  } | null
}

export type CustomerAddressesResult = {
  customer?: {
    id: string
    defaultAddress?: AddressNode | null
    addresses?: {
      edges: { cursor?: string | null; node: AddressNode }[]
      pageInfo?: {
        hasNextPage?: boolean | null
        endCursor?: string | null
      } | null
    } | null
  } | null
}

export type MailingAddressInput = {
  firstName?: string | null
  lastName?: string | null
  address1: string
  address2?: string | null
  city?: string | null
  province?: string | null
  zip?: string | null
  country: string
  phone?: string | null
}

export type CustomerUpdateInput = {
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}
