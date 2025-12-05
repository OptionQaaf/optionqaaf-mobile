/* Customer account orders service */
import { customerGraphQL } from "@/lib/shopify/customer/client"

const CUSTOMER_ORDERS_QUERY = /* GraphQL */ `
  query CustomerOrders($first: Int!, $after: String) {
    customer {
      orders(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            name
            confirmationNumber
            createdAt
            processedAt
            currencyCode
            statusPageUrl
            note
            totalPrice {
              amount
              currencyCode
            }
            lineItems(first: 5) {
              nodes {
                id
                title
                quantity
                currentTotalPrice {
                  amount
                  currencyCode
                }
                productId
                variantId
                variantTitle
                image {
                  url
                  altText
                }
              }
            }
            fulfillments(first: 1) {
              nodes {
                status
                createdAt
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

const CUSTOMER_ORDER_QUERY = /* GraphQL */ `
  query CustomerOrder($id: ID!, $lineItemLimit: Int!) {
    order(id: $id) {
      id
      name
      confirmationNumber
      createdAt
      processedAt
      currencyCode
      statusPageUrl
      note
      subtotal {
        amount
        currencyCode
      }
      totalPrice {
        amount
        currencyCode
      }
      totalTax {
        amount
        currencyCode
      }
      totalShipping {
        amount
        currencyCode
      }
      totalRefunded {
        amount
        currencyCode
      }
      billingAddress {
        id
        formatted
        address1
        address2
        city
        province
        country
        zip
      }
      shippingAddress {
        id
        formatted
        address1
        address2
        city
        province
        country
        zip
      }
      customAttributes {
        key
        value
      }
      lineItems(first: $lineItemLimit) {
        nodes {
          id
          title
          quantity
          currentTotalPrice {
            amount
            currencyCode
          }
          productId
          variantId
          variantTitle
          image {
            url
            altText
          }
        }
      }
      fulfillments(first: 5) {
        nodes {
          id
          createdAt
          status
          trackingInformation {
            number
            url
            company
          }
          fulfillmentLineItems(first: $lineItemLimit) {
            edges {
              node {
                quantity
                lineItem {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`

type Maybe<T> = T | null | undefined

type Money = {
  amount?: Maybe<string>
  currencyCode?: Maybe<string>
}

type GraphQLOrderLine = {
  id?: Maybe<string>
  title?: Maybe<string>
  quantity?: Maybe<number>
  currentTotalPrice?: Maybe<Money>
  productId?: Maybe<string>
  variantId?: Maybe<string>
  image?: Maybe<{ url?: Maybe<string>; altText?: Maybe<string> }>
  variantTitle?: Maybe<string>
}

type GraphQLOrderConnection = {
  edges?: Maybe<
    {
      cursor?: Maybe<string>
      node?: Maybe<GraphQLOrder>
    }[]
  >
  pageInfo?: Maybe<{
    hasNextPage?: Maybe<boolean>
    endCursor?: Maybe<string>
  }>
}

type GraphQLOrder = {
  id?: Maybe<string>
  name?: Maybe<string>
  confirmationNumber?: Maybe<string>
  createdAt?: Maybe<string>
  processedAt?: Maybe<string>
  currencyCode?: Maybe<string>
  statusPageUrl?: Maybe<string>
  note?: Maybe<string>
  subtotal?: Maybe<Money>
  totalPrice?: Maybe<Money>
  totalTax?: Maybe<Money>
  totalShipping?: Maybe<Money>
  totalRefunded?: Maybe<Money>
  billingAddress?: Maybe<GraphQLCustomerAddress>
  shippingAddress?: Maybe<GraphQLCustomerAddress>
  customAttributes?: Maybe<
    {
      key?: Maybe<string>
      value?: Maybe<string>
    }[]
  >
  lineItems?: Maybe<{ nodes?: Maybe<(GraphQLOrderLine | null)[]> }>
  fulfillments?: Maybe<{
    nodes?: Maybe<
      {
        id?: Maybe<string>
        createdAt?: Maybe<string>
        status?: Maybe<string>
        trackingInformation?: Maybe<
          {
            number?: Maybe<string>
            url?: Maybe<string>
            company?: Maybe<string>
          }[]
        >
        fulfillmentLineItems?: Maybe<{
          edges?: Maybe<
            {
              node?: Maybe<{
                quantity?: Maybe<number>
                lineItem?: Maybe<GraphQLOrderLine>
              }>
            }[]
          >
        }>
      }[]
    >
  }>
}

type GraphQLCustomerAddress = {
  id?: Maybe<string>
  formatted?: Maybe<string[]>
  address1?: Maybe<string>
  address2?: Maybe<string>
  city?: Maybe<string>
  province?: Maybe<string>
  country?: Maybe<string>
  zip?: Maybe<string>
}

type CustomerOrdersQueryResult = {
  customer?: Maybe<{
    orders?: Maybe<GraphQLOrderConnection>
  }>
}

type CustomerOrderQueryResult = {
  order?: Maybe<GraphQLOrder>
}

export type OrderAddress = {
  id: string
  lines: string[]
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  country?: string | null
  zip?: string | null
}

export type OrderLineItem = {
  id: string
  title: string
  quantity: number
  subtotal?: MoneyValue | null
  variantTitle?: string | null
  imageUrl?: string | null
  imageAlt?: string | null
  productId?: string | null
  variantId?: string | null
}

export type MoneyValue = {
  amount: number
  currencyCode: string
}

export type OrderSummary = {
  id: string
  name: string
  confirmationNumber?: string | null
  createdAt: string
  processedAt?: string | null
  currencyCode: string
  totalPrice?: MoneyValue | null
  statusPageUrl?: string | null
  lineItemsPreview: OrderLineItem[]
  latestFulfillmentStatus?: string | null
  note?: string | null
}

export type CustomerOrdersPage = {
  orders: OrderSummary[]
  pageInfo: {
    hasNextPage: boolean
    endCursor?: string | null
  }
}

export type OrderDetail = OrderSummary & {
  subtotal?: MoneyValue | null
  totalTax?: MoneyValue | null
  totalShipping?: MoneyValue | null
  totalRefunded?: MoneyValue | null
  billingAddress?: OrderAddress | null
  shippingAddress?: OrderAddress | null
  customAttributes: Array<{ key: string; value?: string | null }>
  fulfillments: Array<{
    id: string
    createdAt: string | null
    status: string | null
    trackingInfo: Array<{
      number: string | null
      url: string | null
      company: string | null
    }>
    lineItems: Array<{
      lineItemId: string
      quantity: number
    }>
  }>
  lineItems: OrderLineItem[]
  fulfilledLineItemQuantities: Record<string, number>
}

function toMoneyValue(m?: Maybe<Money>): MoneyValue | null {
  if (!m?.amount || !m?.currencyCode) return null
  const amount = Number(m.amount)
  if (!Number.isFinite(amount)) return null
  return { amount, currencyCode: m.currencyCode }
}

function normalizeAddress(address: Maybe<GraphQLCustomerAddress>): OrderAddress | null {
  if (!address?.id) return null
  const lines = Array.isArray(address.formatted)
    ? address.formatted.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    : []
  return {
    id: address.id,
    lines,
    address1: address.address1 ?? null,
    address2: address.address2 ?? null,
    city: address.city ?? null,
    province: address.province ?? null,
    country: address.country ?? null,
    zip: address.zip ?? null,
  }
}

function normalizeLineItem(node: Maybe<GraphQLOrderLine>): OrderLineItem | null {
  if (!node?.id) return null
  return {
    id: node.id,
    title: node.title ?? "Item",
    quantity: Number(node.quantity ?? 0),
    subtotal: toMoneyValue(node.currentTotalPrice),
    variantTitle: node.variantTitle ?? null,
    imageUrl: node.image?.url ?? null,
    imageAlt: node.image?.altText ?? null,
    productId: node.productId ?? null,
    variantId: node.variantId ?? null,
  }
}

function normalizeSummary(order: Maybe<GraphQLOrder>): OrderSummary | null {
  if (!order?.id || !order?.name || !order.createdAt || !order.currencyCode) return null
  const preview =
    order.lineItems?.nodes
      ?.map(normalizeLineItem)
      .filter((item): item is OrderLineItem => !!item)
      .slice(0, 5) ?? []

  const latestFulfillment = order.fulfillments?.nodes?.find((node): node is NonNullable<typeof node> => !!node) ?? null
  const fulfillmentStatus = latestFulfillment?.status ?? null

  return {
    id: order.id,
    name: order.name,
    confirmationNumber: order.confirmationNumber ?? null,
    createdAt: order.createdAt,
    processedAt: order.processedAt ?? null,
    currencyCode: order.currencyCode,
    totalPrice: toMoneyValue(order.totalPrice),
    statusPageUrl: order.statusPageUrl ?? null,
    lineItemsPreview: preview,
    latestFulfillmentStatus: fulfillmentStatus,
    note: order.note ?? null,
  }
}

function normalizeDetail(order: Maybe<GraphQLOrder>): OrderDetail | null {
  const summary = normalizeSummary(order)
  if (!summary) return null

  const lineItems =
    order?.lineItems?.nodes?.map(normalizeLineItem).filter((item): item is OrderLineItem => !!item) ?? []

  const fulfilledQuantityMap = new Map<string, number>()

  const fulfillments =
    order?.fulfillments?.nodes
      ?.map((node) => {
        if (!node?.id) return null
        const tracking =
          node.trackingInformation?.map((info) => ({
            number: info?.number ?? null,
            url: info?.url ?? null,
            company: info?.company ?? null,
          })) ?? []

        const fulfillmentLineItems =
          node.fulfillmentLineItems?.edges
            ?.map((edge) => {
              const lineItemId = edge?.node?.lineItem?.id
              if (!lineItemId) return null
              const quantity = Number(edge?.node?.quantity ?? 0)
              if (!Number.isFinite(quantity) || quantity <= 0) return null
              fulfilledQuantityMap.set(lineItemId, (fulfilledQuantityMap.get(lineItemId) ?? 0) + quantity)
              return { lineItemId, quantity }
            })
            .filter((item): item is { lineItemId: string; quantity: number } => !!item) ?? []

        return {
          id: node.id,
          createdAt: node.createdAt ?? null,
          status: node.status ?? null,
          trackingInfo: tracking,
          lineItems: fulfillmentLineItems,
        }
      })
      .filter((f): f is OrderDetail["fulfillments"][number] => !!f) ?? []

  return {
    ...summary,
    subtotal: toMoneyValue(order?.subtotal),
    totalTax: toMoneyValue(order?.totalTax),
    totalShipping: toMoneyValue(order?.totalShipping),
    totalRefunded: toMoneyValue(order?.totalRefunded),
    billingAddress: normalizeAddress(order?.billingAddress),
    shippingAddress: normalizeAddress(order?.shippingAddress),
    customAttributes:
      order?.customAttributes
        ?.map((attr) => ({
          key: attr?.key ?? "",
          value: attr?.value ?? null,
        }))
        .filter((attr) => Boolean(attr.key)) ?? [],
    fulfillments,
    lineItems,
    fulfilledLineItemQuantities: Object.fromEntries(fulfilledQuantityMap.entries()),
  }
}

export async function fetchCustomerOrders(args: { first: number; after?: string | null }): Promise<CustomerOrdersPage> {
  const data = await customerGraphQL<CustomerOrdersQueryResult>(CUSTOMER_ORDERS_QUERY, {
    first: args.first,
    after: args.after ?? null,
  })

  const orders =
    data.customer?.orders?.edges
      ?.map((edge) => normalizeSummary(edge?.node))
      .filter((order): order is OrderSummary => !!order) ?? []

  return {
    orders,
    pageInfo: {
      hasNextPage: Boolean(data.customer?.orders?.pageInfo?.hasNextPage),
      endCursor: data.customer?.orders?.pageInfo?.endCursor ?? null,
    },
  }
}

export async function fetchCustomerOrder(orderId: string, lineItemLimit = 50): Promise<OrderDetail> {
  const data = await customerGraphQL<CustomerOrderQueryResult>(CUSTOMER_ORDER_QUERY, {
    id: orderId,
    lineItemLimit,
  })
  const detail = normalizeDetail(data.order)
  if (!detail) throw new Error("Order not found")
  return detail
}
