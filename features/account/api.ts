import { ensureCustomerAccessToken, refreshCustomerAccessToken, signOutCustomer } from "@/features/account/oauth"
import { useCustomerSession } from "@/features/account/session"
import { qk } from "@/lib/shopify/queryKeys"
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerAccountOverview,
  getCustomerAddresses,
  getCustomerOrders,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  updateCustomerProfile,
} from "@/lib/shopify/services/customer"
import type { CustomerUpdateInput, MailingAddressInput } from "@/lib/shopify/types/customer"
import { ShopifyError } from "@/lib/shopify/client"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

async function requireAccessToken() {
  const token = await ensureCustomerAccessToken()
  if (!token) {
    throw new ShopifyError("Not authenticated")
  }
  return token
}

export function useCustomerOverview(options?: { enabled?: boolean }) {
  const rawToken = useCustomerSession((s) => s.accessToken)
  return useQuery({
    queryKey: qk.customerOverview(),
    enabled: !!rawToken && (options?.enabled ?? true),
    queryFn: async () => {
      const token = await requireAccessToken()
      return getCustomerAccountOverview(token)
    },
  })
}

export function useCustomerAddresses(options?: { enabled?: boolean; pageSize?: number }) {
  const rawToken = useCustomerSession((s) => s.accessToken)
  return useQuery({
    queryKey: qk.customerAddresses(),
    enabled: !!rawToken && (options?.enabled ?? true),
    queryFn: async () => {
      const token = await requireAccessToken()
      return getCustomerAddresses(token)
    },
  })
}

type CustomerOrdersParams = {
  enabled?: boolean
  pageSize?: number
}

export function useCustomerOrders(params?: CustomerOrdersParams) {
  const rawToken = useCustomerSession((s) => s.accessToken)
  const pageSize = params?.pageSize ?? 10

  return useInfiniteQuery({
    queryKey: qk.customerOrders({ pageSize }),
    enabled: !!rawToken && (params?.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const token = await requireAccessToken()
      const res = await getCustomerOrders(token, {
        first: pageSize,
        after: pageParam,
      })
      return res
    },
    getNextPageParam: (lastPage) => {
      const pageInfo = lastPage.customer?.orders?.pageInfo
      if (pageInfo?.hasNextPage) return pageInfo.endCursor ?? undefined
      return undefined
    },
  })
}

function invalidateAccountCaches(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.customerOverview() as any }).catch(() => {})
  qc.invalidateQueries({ queryKey: qk.customerAddresses() as any }).catch(() => {})
  qc.invalidateQueries({ queryKey: ["customer", "orders"] }).catch(() => {})
}

export function useUpdateCustomerProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CustomerUpdateInput) => {
      const token = await requireAccessToken()
      return updateCustomerProfile(token, payload)
    },
    onSuccess: () => invalidateAccountCaches(qc),
  })
}

export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: MailingAddressInput) => {
      const token = await requireAccessToken()
      return createCustomerAddress(token, payload)
    },
    onSuccess: () => invalidateAccountCaches(qc),
  })
}

export function useUpdateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; address: MailingAddressInput }) => {
      const token = await requireAccessToken()
      return updateCustomerAddress(token, payload.id, payload.address)
    },
    onSuccess: () => invalidateAccountCaches(qc),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await requireAccessToken()
      return deleteCustomerAddress(token, id)
    },
    onSuccess: () => invalidateAccountCaches(qc),
  })
}

export function useSetDefaultAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (addressId: string) => {
      const token = await requireAccessToken()
      return setDefaultCustomerAddress(token, addressId)
    },
    onSuccess: () => invalidateAccountCaches(qc),
  })
}

export async function forceRefreshCustomerSession() {
  return refreshCustomerAccessToken(true)
}

export { signOutCustomer }
