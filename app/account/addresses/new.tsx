import { AddressForm, type AddressFormData } from "@/features/account/addresses/AddressForm"
import { useCreateCustomerAddress } from "@/features/account/api"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { useRouter } from "expo-router"
import { useCallback } from "react"

export default function NewAddressScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/addresses/new" as const)} />}
    >
      <Screen bleedBottom>
        <MenuBar back />
        <NewAddressContent />
      </Screen>
    </AuthGate>
  )
}

function NewAddressContent() {
  const router = useRouter()
  const { show } = useToast()
  const { mutateAsync: createAddress, isPending } = useCreateCustomerAddress()

  const handleSubmit = useCallback(
    async (values: AddressFormData) => {
      try {
        await createAddress({
          address: formToInput(values),
          defaultAddress: values.defaultAddress,
        })
        show({ title: "Address saved", type: "success" })
        router.replace("/account/addresses" as const)
      } catch (err: any) {
        const message = err?.message || "Could not save that address"
        show({ title: message, type: "danger" })
      }
    },
    [createAddress, router, show],
  )

  return <AddressForm submitLabel="Save address" onSubmit={handleSubmit} isSubmitting={isPending} />
}

function formToInput(values: AddressFormData) {
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
