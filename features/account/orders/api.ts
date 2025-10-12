import { useInfiniteQuery, useQuery } from "@tanstack/react-query"

import { fetchCustomerOrder, fetchCustomerOrders } from "@/lib/shopify/customer/orders"
import { qk } from "@/lib/shopify/queryKeys"

const DEFAULT_PAGE_SIZE = 10

export function useCustomerOrders(pageSize = DEFAULT_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: qk.customerOrders(pageSize),
    queryFn: ({ pageParam }) => fetchCustomerOrders({ first: pageSize, after: pageParam ?? null }),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor ?? undefined : undefined,
    initialPageParam: null as string | null,
  })
}

export function useCustomerOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: orderId ? qk.customerOrder(orderId) : qk.customerOrder(""),
    queryFn: () => {
      if (!orderId) throw new Error("Missing order id")
      return fetchCustomerOrder(orderId)
    },
    enabled: !!orderId,
  })
}
