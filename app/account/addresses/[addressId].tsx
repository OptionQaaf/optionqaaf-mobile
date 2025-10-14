import { AddressForm, type AddressFormSubmitData } from "@/features/account/addresses/AddressForm"
import { useCustomerProfile, useDeleteCustomerAddress, useUpdateCustomerAddress } from "@/features/account/api"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useMemo } from "react"
import { ActivityIndicator, View } from "react-native"

export default function EditAddressScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/addresses" as const)} />}
    >
      <Screen bleedBottom>
        <MenuBar back />
        <EditAddressContent />
      </Screen>
    </AuthGate>
  )
}

function EditAddressContent() {
  const router = useRouter()
  const { addressId } = useLocalSearchParams<{ addressId?: string }>()
  const decodedId = useMemo(() => {
    if (!addressId) return null
    try {
      return decodeURIComponent(addressId)
    } catch {
      return addressId
    }
  }, [addressId])

  const { data: profile, isLoading } = useCustomerProfile()
  const { show } = useToast()
  const { mutateAsync: updateAddress, isPending: updating } = useUpdateCustomerAddress()
  const { mutateAsync: deleteAddress, isPending: deleting } = useDeleteCustomerAddress()

  const address = useMemo(() => {
    if (!decodedId) return null
    return profile?.addresses.find((item) => item.id === decodedId) ?? null
  }, [decodedId, profile?.addresses])

  const isDefault = profile?.defaultAddress?.id === address?.id

  const handleSubmit = useCallback(
    async (values: AddressFormSubmitData) => {
      if (!address) return
      try {
        await updateAddress({
          addressId: address.id,
          address: formToInput(values),
          defaultAddress: values.defaultAddress,
        })
        show({ title: "Address updated", type: "success" })
        router.replace("/account/addresses" as const)
      } catch (err: any) {
        const message = err?.message || "Could not update that address"
        show({ title: message, type: "danger" })
      }
    },
    [address, router, show, updateAddress],
  )

  const handleDelete = useCallback(async () => {
    if (!address) return
    try {
      await deleteAddress(address.id)
      show({ title: "Address removed", type: "success" })
      router.replace("/account/addresses" as const)
    } catch (err: any) {
      const message = err?.message || "Could not remove that address"
      show({ title: message, type: "danger" })
    }
  }, [address, deleteAddress, router, show])

  if (isLoading && !profile) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#111827" />
      </View>
    )
  }

  if (!address) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Card padding="lg" className="gap-3 items-center">
          <Text className="text-[#0f172a] font-geist-semibold text-[16px] text-center">
            We couldn’t find that address
          </Text>
          <Text className="text-[#475569] text-[13px] text-center">
            It may have been removed. Head back to your saved addresses to manage your locations.
          </Text>
          <Button onPress={() => router.replace("/account/addresses" as const)}>Go to addresses</Button>
        </Card>
      </View>
    )
  }

  return (
    <AddressForm
      submitLabel="Update address"
      initialValues={{
        firstName: address.firstName ?? "",
        lastName: address.lastName ?? "",
        company: address.company ?? "",
        phoneNumber: address.phoneNumber ?? "",
        address1: address.address1 ?? "",
        address2: address.address2 ?? "",
        city: address.city ?? "",
        zoneCode: address.zoneCode ?? address.province ?? "",
        territoryCode: address.territoryCode ?? "",
        zip: address.zip ?? "",
        defaultAddress: Boolean(isDefault),
      }}
      onSubmit={handleSubmit}
      onDelete={isDefault ? undefined : handleDelete}
      isSubmitting={updating || deleting}
    />
  )
}

function formToInput(values: AddressFormSubmitData) {
  return {
    firstName: values.firstName.trim() || null,
    lastName: values.lastName.trim() || null,
    company: values.company.trim() || null,
    phoneNumber: values.phoneNumber.trim() || null,
    address1: values.address1.trim() || null,
    address2: values.address2.trim() || null,
    city: values.city.trim() || null,
    zoneCode: values.zoneCode.trim() || null,
    territoryCode: values.territoryCode.trim().toUpperCase() || null,
    zip: values.zip.trim() || null,
  }
}
