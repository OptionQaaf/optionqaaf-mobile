import { AddressForm, type AddressFormSubmitData } from "@/features/account/addresses/AddressForm"
import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { useRouter } from "expo-router"
import { useMemo, useState } from "react"
import { ScrollView, View, Pressable } from "react-native"

export default function AddressReviewScreen() {
  const router = useRouter()
  return (
    <Screen bleedBottom>
      <MenuBar back />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} className="bg-[#f8fafc]">
        <View className="gap-6 px-5 pt-6 pb-10">
          <ReviewIntro />
          <SavedAddressPicker onConfirmed={() => router.replace("/" as const)} />
        </View>
      </ScrollView>
    </Screen>
  )
}

function ReviewIntro() {
  return (
    <Card padding="lg" className="gap-2">
      <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Review your delivery address</Text>
      <Text className="text-[#475569] text-[13px] leading-[18px]">
        Apple Pay uses the address saved in your wallet. Double-check the details, switch to a saved address, or
        update the fields below before we finalize your order.
      </Text>
    </Card>
  )
}

function SavedAddressPicker({ onConfirmed }: { onConfirmed: () => void }) {
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile, isLoading } = useCustomerProfile({ enabled: isAuthenticated })
  const { show } = useToast()
  const addresses = useMemo(() => profile?.customer?.addresses?.nodes ?? [], [profile])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(addresses[0]?.id ?? null)
  const [mode, setMode] = useState<"saved" | "new">(addresses.length ? "saved" : "new")

  const handleConfirmSaved = () => {
    if (!selectedAddressId) {
      show({ title: "Choose an address or switch to a new one", type: "danger" })
      return
    }
    show({ title: "Address confirmed", type: "success" })
    onConfirmed()
  }

  const handleConfirmNew = (values: AddressFormSubmitData) => {
    const summary = [values.address1, values.city, values.zoneCode || values.territoryCode].filter(Boolean).join(", ")
    show({ title: summary ? `Address updated: ${summary}` : "Address updated", type: "success" })
    onConfirmed()
  }

  if (isLoading) {
    return (
      <Card padding="lg" className="gap-2">
        <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Loading your addresses…</Text>
        <Text className="text-[#64748b] text-[13px]">We’ll show your saved addresses in a moment.</Text>
      </Card>
    )
  }

  return (
    <View className="gap-4">
      {isAuthenticated && addresses.length ? (
        <Card padding="lg" className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Use a saved address</Text>
            <Button variant="ghost" size="sm" onPress={() => setMode(mode === "saved" ? "new" : "saved")}>
              {mode === "saved" ? "Use a new address" : "Use saved"}
            </Button>
          </View>
          <View className="gap-3">
            {addresses.map((address) => (
              <Pressable
                key={address.id}
                onPress={() => {
                  setSelectedAddressId(address.id)
                  setMode("saved")
                }}
                className={`rounded-2xl border ${
                  selectedAddressId === address.id ? "border-[#0f172a]" : "border-[#e2e8f0]"
                } bg-white p-4`}
              >
                <Text className="text-[#0f172a] font-geist-semibold text-[15px]">{address.formatted?.[0]}</Text>
                <Text className="text-[#475569] text-[13px] leading-[18px]">{address.formatted?.slice(1).join(" ")}</Text>
              </Pressable>
            ))}
            <Button onPress={handleConfirmSaved}>Confirm selected address</Button>
          </View>
        </Card>
      ) : null}

      <Card padding="lg" className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Edit or add a new address</Text>
          {addresses.length ? (
            <Button variant="ghost" size="sm" onPress={() => setMode("new")}>Use a new address</Button>
          ) : null}
        </View>
        {mode === "new" || !addresses.length ? (
          <AddressForm submitLabel="Confirm address" onSubmit={handleConfirmNew} />
        ) : (
          <Text className="text-[#475569] text-[13px]">Switch to “Use a new address” to edit details manually.</Text>
        )}
      </Card>
    </View>
  )
}
