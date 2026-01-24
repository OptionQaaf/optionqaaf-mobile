/* Customer account orders service */
import { customerGraphQL } from "@/lib/shopify/customer/client"

const DEFAULT_ORDER_LINE_ITEM_LIMIT = 50
const DEFAULT_FULFILLMENT_LIMIT = 10
const PREVIEW_LINE_ITEM_COUNT = 5

const CUSTOMER_ORDERS_QUERY = /* GraphQL */ `
  query CustomerOrders($first: Int!, $after: String, $lineItemLimit: Int!, $fulfillmentLimit: Int!) {
    customer {
      id
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
            fulfillments(first: $fulfillmentLimit) {
              nodes {
                id
                status
                createdAt
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
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`

const CUSTOMER_ORDER_QUERY = /* GraphQL */ `
  query CustomerOrder($id: ID!, $lineItemLimit: Int!, $fulfillmentLimit: Int!) {
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
      fulfillments(first: $fulfillmentLimit) {
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
    id?: Maybe<string>
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
  tracking?: Array<{
    number: string | null
    url: string | null
    company: string | null
  }>
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

const FULFILLED_FULFILLMENT_STATUSES = new Set(["SUCCESS", "FULFILLED"])
const CANCELLATION_STATUSES = new Set(["CANCELLED", "FAILURE", "FAILED", "ERROR"])

type FulfillmentArtifacts = {
  fulfillments: OrderDetail["fulfillments"]
  fulfilledLineItemQuantities: Map<string, number>
  statuses: string[]
  hasCancellation: boolean
  lineItemTracking: Map<
    string,
    Array<{
      number: string | null
      url: string | null
      company: string | null
    }>
  >
}

function normalizeStatusValue(status?: string | null): string | null {
  const normalized = (status ?? "").trim().toUpperCase()
  return normalized.length ? normalized : null
}

function isFulfillmentCompleted(status?: string | null): boolean {
  const normalized = normalizeStatusValue(status)
  if (!normalized) return false
  return FULFILLED_FULFILLMENT_STATUSES.has(normalized)
}

function isFulfillmentCancelled(status?: string | null): boolean {
  const normalized = normalizeStatusValue(status)
  if (!normalized) return false
  return CANCELLATION_STATUSES.has(normalized) || normalized.includes("CANCEL")
}

function getFulfilledQuantity(
  lineItemId: string,
  fulfilledLineItemQuantities: Map<string, number> | Record<string, number>,
): number {
  if (fulfilledLineItemQuantities instanceof Map) {
    return fulfilledLineItemQuantities.get(lineItemId) ?? 0
  }
  return fulfilledLineItemQuantities[lineItemId] ?? 0
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
    tracking: [],
  }
}

function normalizeLineItems(nodes?: Maybe<(GraphQLOrderLine | null)[]>): OrderLineItem[] {
  return nodes?.map(normalizeLineItem).filter((item): item is OrderLineItem => !!item) ?? []
}

function collectFulfillmentArtifacts(fulfillments: Maybe<GraphQLOrder["fulfillments"]>): FulfillmentArtifacts {
  const normalizedFulfillments: OrderDetail["fulfillments"] = []
  const fulfilledLineItemQuantities = new Map<string, number>()
  const statuses: string[] = []
  let hasCancellation = false
  const lineItemTracking = new Map<
    string,
    Array<{
      number: string | null
      url: string | null
      company: string | null
    }>
  >()

  fulfillments?.nodes?.forEach((node) => {
    if (!node) return
    const status = node.status ?? null
    const normalizedStatus = normalizeStatusValue(status)
    if (normalizedStatus) {
      statuses.push(normalizedStatus)
      if (isFulfillmentCancelled(normalizedStatus)) hasCancellation = true
    }

    const trackingEntries =
      node.trackingInformation
        ?.map((info) => ({
          number: info?.number ?? null,
          url: info?.url ?? null,
          company: info?.company ?? null,
        }))
        .filter((info) => (info.number ?? info.url ?? info.company) !== null) ?? []

    const lineItems =
      node.fulfillmentLineItems?.edges
        ?.map((edge) => {
          const lineItemId = edge?.node?.lineItem?.id
          if (!lineItemId) return null
          const quantity = Number(edge?.node?.quantity ?? 0)
          if (!Number.isFinite(quantity) || quantity <= 0) return null
          if (isFulfillmentCompleted(normalizedStatus)) {
            fulfilledLineItemQuantities.set(lineItemId, (fulfilledLineItemQuantities.get(lineItemId) ?? 0) + quantity)
          }
          if (trackingEntries.length) {
            const existing = lineItemTracking.get(lineItemId) ?? []
            const merged = [...existing]
            trackingEntries.forEach((entry) => {
              const key = `${entry.url ?? ""}|${entry.number ?? ""}|${entry.company ?? ""}`
              const alreadyIncluded = merged.some(
                (tracked) =>
                  `${tracked.url ?? ""}|${tracked.number ?? ""}|${tracked.company ?? ""}` === key,
              )
              if (!alreadyIncluded) merged.push(entry)
            })
            lineItemTracking.set(lineItemId, merged)
          }
          return { lineItemId, quantity }
        })
        .filter((item): item is { lineItemId: string; quantity: number } => !!item) ?? []

    if (node.id) {
      normalizedFulfillments.push({
        id: node.id,
        createdAt: node.createdAt ?? null,
        status,
        trackingInfo: trackingEntries,
        lineItems,
      })
    }
  })

  return { fulfillments: normalizedFulfillments, fulfilledLineItemQuantities, statuses, hasCancellation, lineItemTracking }
}

function computeOrderFulfillmentStatus({
  lineItems,
  fulfilledLineItemQuantities,
  fallbackStatus,
  hasCancellation,
}: {
  lineItems: OrderLineItem[]
  fulfilledLineItemQuantities: Map<string, number> | Record<string, number>
  fallbackStatus?: string | null
  hasCancellation?: boolean
}): string | null {
  const normalizedFallback = normalizeStatusValue(fallbackStatus)
  const cancellationFallback = Boolean(
    hasCancellation || (normalizedFallback ? isFulfillmentCancelled(normalizedFallback) : false),
  )
  const statuses = new Set<string>()
  let hasFulfilled = false
  let hasTrackableLine = false

  for (const item of lineItems) {
    const quantity = Number(item.quantity ?? 0)
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    hasTrackableLine = true
    const fulfilledQuantity = getFulfilledQuantity(item.id, fulfilledLineItemQuantities)
    if (fulfilledQuantity <= 0) {
      statuses.add(cancellationFallback ? "CANCELLED" : "UNFULFILLED")
      continue
    }
    if (fulfilledQuantity >= quantity) {
      statuses.add("FULFILLED")
      hasFulfilled = true
      continue
    }
    statuses.add("PARTIALLY_FULFILLED")
    hasFulfilled = true
  }

  if (!hasTrackableLine) {
    return normalizedFallback
  }

  if (statuses.size === 1) {
    const [status] = Array.from(statuses)
    return status ?? normalizedFallback ?? null
  }

  if (hasFulfilled) {
    return "PARTIALLY_FULFILLED"
  }

  return "UNFULFILLED"
}

function normalizeSummary(
  order: Maybe<GraphQLOrder>,
  options?: { lineItems?: OrderLineItem[]; fulfillmentArtifacts?: FulfillmentArtifacts },
): OrderSummary | null {
  if (!order?.id || !order?.name || !order.createdAt || !order.currencyCode) return null
  const lineItems = options?.lineItems ?? normalizeLineItems(order.lineItems?.nodes)
  const fulfillmentArtifacts = options?.fulfillmentArtifacts ?? collectFulfillmentArtifacts(order.fulfillments)
  const fallbackStatus = fulfillmentArtifacts.statuses[0] ?? null
  const latestFulfillmentStatus =
    computeOrderFulfillmentStatus({
      lineItems,
      fulfilledLineItemQuantities: fulfillmentArtifacts.fulfilledLineItemQuantities,
      fallbackStatus,
      hasCancellation: fulfillmentArtifacts.hasCancellation,
    }) ?? fallbackStatus

  const preview = lineItems.slice(0, PREVIEW_LINE_ITEM_COUNT)

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
    latestFulfillmentStatus,
    note: order.note ?? null,
  }
}

function normalizeDetail(order: Maybe<GraphQLOrder>): OrderDetail | null {
  const fulfillmentArtifacts = collectFulfillmentArtifacts(order?.fulfillments)
  const lineItems = normalizeLineItems(order?.lineItems?.nodes)
  const lineItemsWithTracking = lineItems.map((item) => ({
    ...item,
    tracking: fulfillmentArtifacts.lineItemTracking.get(item.id) ?? [],
  }))
  const summary = normalizeSummary(order, { lineItems: lineItemsWithTracking, fulfillmentArtifacts })
  if (!summary) return null

  return {
    ...summary,
    subtotal: toMoneyValue(order?.subtotal),
    totalTax: toMoneyValue(order?.totalTax),
    totalShipping: toMoneyValue(order?.totalShipping),
    totalRefunded: toMoneyValue(order?.totalRefunded),
    billingAddress: normalizeAddress(order?.billingAddress),
    shippingAddress: normalizeAddress(order?.shippingAddress),
    customAttributes: [],
    fulfillments: fulfillmentArtifacts.fulfillments,
    lineItems: lineItemsWithTracking,
    fulfilledLineItemQuantities: Object.fromEntries(fulfillmentArtifacts.fulfilledLineItemQuantities.entries()),
  }
}

export async function fetchCustomerOrders(args: { first: number; after?: string | null }): Promise<CustomerOrdersPage> {
  const data = await customerGraphQL<CustomerOrdersQueryResult>(CUSTOMER_ORDERS_QUERY, {
    first: args.first,
    after: args.after ?? null,
    lineItemLimit: DEFAULT_ORDER_LINE_ITEM_LIMIT,
    fulfillmentLimit: DEFAULT_FULFILLMENT_LIMIT,
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

export async function fetchCustomerOrder(
  orderId: string,
  lineItemLimit = DEFAULT_ORDER_LINE_ITEM_LIMIT,
  fulfillmentLimit = DEFAULT_FULFILLMENT_LIMIT,
): Promise<OrderDetail> {
  const data = await customerGraphQL<CustomerOrderQueryResult>(CUSTOMER_ORDER_QUERY, {
    id: orderId,
    lineItemLimit,
    fulfillmentLimit,
  })
  const detail = normalizeDetail(data.order)
  if (!detail) throw new Error("Order not found")
  return detail
}
