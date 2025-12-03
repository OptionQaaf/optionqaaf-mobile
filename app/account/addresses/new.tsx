import { AddressForm, type AddressFormSubmitData } from "@/features/account/addresses/AddressForm"
import { formToInput } from "@/features/account/addresses/formMapping"
import { useCreateCustomerAddress } from "@/features/account/api"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useMemo } from "react"
import { KeyboardAvoidingView, Platform } from "react-native"

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
  const { redirect, checkoutUrl, cartId } = useLocalSearchParams<{
    redirect?: string
    checkoutUrl?: string
    cartId?: string
  }>()

  const decodedCheckoutUrl = useMemo(() => {
    if (typeof checkoutUrl !== "string") return null
    try {
      return decodeURIComponent(checkoutUrl)
    } catch {
      return checkoutUrl
    }
  }, [checkoutUrl])

  const handleSubmit = useCallback(
    async (values: AddressFormSubmitData) => {
      try {
        await createAddress({
          address: formToInput(values),
          defaultAddress: values.defaultAddress,
        })
        show({ title: "Address saved", type: "success" })
        if (redirect === "/checkout" && decodedCheckoutUrl) {
          router.replace({
            pathname: redirect,
            params: { url: decodedCheckoutUrl, cartId: typeof cartId === "string" ? cartId : "" },
          } as any)
          return
        }
        router.replace("/account/addresses" as const)
      } catch (err: any) {
        const message = err?.message || "Could not save that address"
        show({ title: message, type: "danger" })
        console.error("Error creating address:", err)
      }
    },
    [cartId, createAddress, decodedCheckoutUrl, redirect, router, show],
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <AddressForm submitLabel="Save address" onSubmit={handleSubmit} isSubmitting={isPending} />
    </KeyboardAvoidingView>
  )
}
