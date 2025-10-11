import { useCallback, useMemo } from "react"
import { router } from "expo-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { qk } from "@/lib/shopify/queryKeys"

import { startLogin, logout as remoteLogout } from "./auth"
import { createCustomerGraphQLClient } from "./client"
import { AuthExpiredError, GraphQLErrorWithStatus } from "./errors"
import { CUSTOMER_ADDRESSES_QUERY, CUSTOMER_BASICS_QUERY, CUSTOMER_ORDERS_QUERY } from "./queries"
import type {
  CustomerAccountSnapshot,
  CustomerAddressesQueryResult,
  CustomerBasicsQueryResult,
  CustomerOrdersQueryResult,
  StoredCustomerSession,
} from "./types"
import { clearStoredCustomerSession, getStoredCustomerSession, getValidAccessToken } from "./tokens"

type CustomerSessionState = { status: "unauthenticated" } | { status: "authenticated"; session: StoredCustomerSession }

async function loadSession(): Promise<CustomerSessionState> {
  const session = await getStoredCustomerSession()
  if (!session) return { status: "unauthenticated" }
  try {
    const { session: validated } = await getValidAccessToken()
    return { status: "authenticated", session: validated }
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      await clearStoredCustomerSession()
      return { status: "unauthenticated" }
    }
    throw error
  }
}

async function fetchCustomerOverview(session: StoredCustomerSession): Promise<CustomerAccountSnapshot> {
  const client = await createCustomerGraphQLClient()
  const fetch = client.fetchGraphQL

  const [basics, addresses, orders] = await Promise.all([
    fetch<CustomerBasicsQueryResult>("CustomerBasics", CUSTOMER_BASICS_QUERY),
    fetch<CustomerAddressesQueryResult>("CustomerAddresses", CUSTOMER_ADDRESSES_QUERY),
    fetch<CustomerOrdersQueryResult>("CustomerOrders", CUSTOMER_ORDERS_QUERY),
  ])

  const customer = basics.customer
  if (!customer) return null

  return {
    ...customer,
    addresses: addresses.customer?.addresses ?? { nodes: [] },
    orders: orders.customer?.orders ?? { nodes: [] },
  }
}

type UseCustomerSessionResult = {
  status: "loading" | CustomerSessionState["status"]
  customer: CustomerAccountSnapshot
  isFetchingCustomer: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  error: Error | null
  accessToken: string | null
}

export function useCustomerSession(): UseCustomerSessionResult {
  const queryClient = useQueryClient()

  const sessionQuery = useQuery({
    queryKey: qk.customerSession(),
    queryFn: loadSession,
    staleTime: 0,
    gcTime: 0,
    retry: 0,
  })

  const customerQuery = useQuery({
    queryKey: qk.customerOverview(),
    queryFn: async () => {
      if (sessionQuery.data?.status !== "authenticated") return null
      try {
        return await fetchCustomerOverview(sessionQuery.data.session)
      } catch (error) {
        if (error instanceof GraphQLErrorWithStatus && error.status === 401) {
          await clearStoredCustomerSession()
          await queryClient.invalidateQueries({ queryKey: qk.customerSession() })
        }
        throw error
      }
    },
    enabled: sessionQuery.data?.status === "authenticated",
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60 * 1000,
  })

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.customerOverview() })
    await queryClient.invalidateQueries({ queryKey: qk.customerSession() })
  }, [queryClient])

  const logout = useCallback(async () => {
    await remoteLogout()
    await queryClient.invalidateQueries({ queryKey: qk.customerSession() })
    await queryClient.removeQueries({ queryKey: qk.customerOverview() })
  }, [queryClient])

  return useMemo(() => {
    const status = sessionQuery.isLoading ? "loading" : (sessionQuery.data?.status ?? "unauthenticated")
    const customer = customerQuery.data ?? null
    const accessToken = sessionQuery.data?.status === "authenticated" ? sessionQuery.data.session.accessToken : null

    return {
      status,
      customer,
      isFetchingCustomer: customerQuery.isFetching,
      refresh,
      logout,
      error: customerQuery.error instanceof Error ? customerQuery.error : null,
      accessToken,
    }
  }, [
    sessionQuery.data,
    sessionQuery.isLoading,
    customerQuery.data,
    customerQuery.isFetching,
    customerQuery.error,
    refresh,
    logout,
  ])
}

type LoginResult = { session: StoredCustomerSession }

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation<LoginResult, Error>({
    mutationFn: async () => {
      const session = await startLogin()
      await queryClient.invalidateQueries({ queryKey: qk.customerSession() })
      await queryClient.removeQueries({ queryKey: qk.customerOverview() })
      router.replace("/account")
      return { session }
    },
  })
}
