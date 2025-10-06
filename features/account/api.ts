import type { GraphQLClient } from "graphql-request"

import { callCustomerApi } from "@/lib/shopify/customer/client"
import { CUSTOMER_OVERVIEW_QUERY, CustomerOverview, customerOverviewSchema } from "@/lib/shopify/customer/hooks"

export async function getCustomerOverview(client: GraphQLClient): Promise<CustomerOverview | null> {
  const data = await callCustomerApi(() => client.rawRequest(CUSTOMER_OVERVIEW_QUERY))
  const parsed = customerOverviewSchema.parse(data)
  return parsed.customer ?? null
}
