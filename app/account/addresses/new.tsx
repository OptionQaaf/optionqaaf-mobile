import { AddressForm, type AddressFormSubmitData } from "@/features/account/addresses/AddressForm"
import { formToInput } from "@/features/account/addresses/formMapping"
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
    async (values: AddressFormSubmitData) => {
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
