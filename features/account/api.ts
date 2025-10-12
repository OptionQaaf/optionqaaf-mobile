import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  CustomerProfile,
  UpdateCustomerProfileInput,
  fetchCustomerProfile,
  updateCustomerProfile,
} from "@/lib/shopify/customer/profile"
import { qk } from "@/lib/shopify/queryKeys"

type UseCustomerProfileOptions = {
  enabled?: boolean
  addressLimit?: number
}

export function useCustomerProfile(options: UseCustomerProfileOptions = {}) {
  const { enabled = true, addressLimit = 6 } = options
  return useQuery<CustomerProfile>({
    queryKey: qk.customerProfile(),
    queryFn: () => fetchCustomerProfile(addressLimit),
    enabled,
  })
}

export function useUpdateCustomerProfile(addressLimit = 6) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateCustomerProfileInput) => updateCustomerProfile(input, addressLimit),
    onSuccess: (profile) => {
      qc.setQueryData(qk.customerProfile(), profile)
    },
  })
}
