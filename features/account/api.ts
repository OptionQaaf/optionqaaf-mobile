import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  CustomerProfile,
  UpdateCustomerProfileInput,
  fetchCustomerProfile,
  updateCustomerProfile,
} from "@/lib/shopify/customer/profile"
import {
  createCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  type CustomerAddressInput,
} from "@/lib/shopify/customer/addresses"
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

export function useCreateCustomerAddress(addressLimit = 6) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { address: CustomerAddressInput; defaultAddress?: boolean }) =>
      createCustomerAddress(input.address, {
        defaultAddress: input.defaultAddress,
        addressLimit,
      }),
    onSuccess: (profile) => {
      qc.setQueryData(qk.customerProfile(), profile)
    },
  })
}

export function useUpdateCustomerAddress(addressLimit = 6) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      addressId: string
      address: CustomerAddressInput
      defaultAddress?: boolean
    }) =>
      updateCustomerAddress(input.addressId, input.address, {
        defaultAddress: input.defaultAddress,
        addressLimit,
      }),
    onSuccess: (profile) => {
      qc.setQueryData(qk.customerProfile(), profile)
    },
  })
}

export function useDeleteCustomerAddress(addressLimit = 6) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (addressId: string) => deleteCustomerAddress(addressId, addressLimit),
    onSuccess: (profile) => {
      qc.setQueryData(qk.customerProfile(), profile)
    },
  })
}

export function useSetDefaultCustomerAddress(addressLimit = 6) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (addressId: string) => setDefaultCustomerAddress(addressId, addressLimit),
    onSuccess: (profile) => {
      qc.setQueryData(qk.customerProfile(), profile)
    },
  })
}
