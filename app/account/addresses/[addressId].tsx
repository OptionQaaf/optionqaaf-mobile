import { AddressForm, type AddressFormSubmitData } from "@/features/account/addresses/AddressForm"
import { buildInitialValuesFromAddress, formToInput } from "@/features/account/addresses/formMapping"
import { useCustomerProfile, useDeleteCustomerAddress, useUpdateCustomerAddress } from "@/features/account/api"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { Button } from "@/ui/primitives/Button"
import { Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useMemo } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from "react-native"

export default function EditAddressScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/addresses" as const)} />}
    >
      <Screen bleedBottom>
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <AddressForm
        submitLabel="Update address"
        initialValues={buildInitialValuesFromAddress(address, isDefault)}
        onSubmit={handleSubmit}
        onDelete={isDefault ? undefined : handleDelete}
        isSubmitting={updating || deleting}
      />
    </KeyboardAvoidingView>
  )
}
