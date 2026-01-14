import { ADDRESS_METADATA_PREFIX, stripAddressMetadata } from "@/features/account/addresses/formMapping"
import { useCustomerProfile, useDeleteCustomerAddress, useSetDefaultCustomerAddress } from "@/features/account/api"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { CustomerAddress } from "@/lib/shopify/customer/profile"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native"

export default function AccountAddressesScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/addresses" as const)} />}
    >
      <Screen bleedBottom>
        <MenuBar back />
        <AddressesContent />
      </Screen>
    </AuthGate>
  )
}

function AddressesContent() {
  const router = useRouter()
  const { show } = useToast()
  const { data: profile, isLoading, isRefetching, refetch, error } = useCustomerProfile()
  const { mutateAsync: setDefault, isPending: settingDefault } = useSetDefaultCustomerAddress()
  const { mutateAsync: removeAddress } = useDeleteCustomerAddress()
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null)

  const defaultId = profile?.defaultAddress?.id ?? null

  const addresses = useMemo(() => {
    const list = profile?.addresses ?? []
    if (!list.length) return []
    // Default goes first for quick recognition in UI.
    return [...list].sort((a, b) => {
      if (a.id === defaultId) return -1
      if (b.id === defaultId) return 1
      return 0
    })
  }, [defaultId, profile?.addresses])

  const handleSetDefault = useCallback(
    async (addressId: string) => {
      try {
        await setDefault(addressId)
        show({ title: "Default address updated", type: "success" })
      } catch (err: any) {
        const message = err?.message || "Could not update the default address"
        show({ title: message, type: "danger" })
      }
    },
    [setDefault, show],
  )

  const handleEdit = useCallback(
    (address: CustomerAddress) => {
      const encoded = encodeURIComponent(address.id)
      router.push(`/account/addresses/${encoded}` as const)
    },
    [router],
  )

  const handleAddNew = useCallback(() => {
    router.push("/account/addresses/new" as const)
  }, [router])

  const handleRemove = useCallback(
    async (addressId: string) => {
      setDeletingAddressId(addressId)
      try {
        await removeAddress(addressId)
        show({ title: "Address deleted", type: "success" })
      } catch (err: any) {
        const message = err?.message || "Could not delete that address"
        show({ title: message, type: "danger" })
      } finally {
        setDeletingAddressId(null)
      }
    },
    [removeAddress, show],
  )

  const renderAddress = useCallback(
    (address: CustomerAddress) => {
      const isDefault = address.id === defaultId
      const baseLines = address.lines.length ? address.lines : buildLines(address)
      const lines = baseLines
        .map((line) => cleanAddressLine(line))
        .filter((line): line is string => Boolean(line && line.trim().length))

      return (
        <Card key={address.id} padding="lg" className={`gap-3 ${isDefault ? "bg-[#e0f2fe] border-[#0284c7]" : ""}`}>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-1">
              <Text className="text-[#0f172a] font-geist-semibold text-[15px]">
                {isDefault ? "Default address" : "Saved address"}
              </Text>
              {lines.map((line, index) => (
                <Text key={`${line}-${index}`} className="text-[#475569] text-[13px] leading-[18px]">
                  {line}
                </Text>
              ))}
            </View>
            {isDefault ? (
              <View className="rounded-full bg-[#e0f2fe] px-3 py-1">
                <Text className="text-[#0369a1] text-[12px] font-geist-medium">Default</Text>
              </View>
            ) : null}
          </View>
          <View className="flex-row gap-3">
            {!isDefault ? (
              <Button
                variant="outline"
                size="sm"
                onPress={() => handleSetDefault(address.id)}
                isLoading={settingDefault}
                className="flex-1"
              >
                Set as default
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onPress={() => handleEdit(address)} className="flex-1">
              Edit
            </Button>
            {!isDefault ? (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => handleRemove(address.id)}
                isLoading={deletingAddressId === address.id}
                className="flex-1"
              >
                Remove
              </Button>
            ) : null}
          </View>
        </Card>
      )
    },
    [defaultId, deletingAddressId, handleEdit, handleRemove, handleSetDefault, settingDefault],
  )

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Could not load addresses"
      show({ title: message, type: "danger" })
    }
  }, [error, show])

  return (
    <ScrollView
      className="bg-[#f8fafc]"
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#111827" />}
    >
      <View className="px-5 pt-6 pb-4 gap-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-[#0f172a] font-geist-semibold text-[18px]">Your addresses</Text>
          <Button size="sm" onPress={handleAddNew}>
            Add new
          </Button>
        </View>

        {isLoading ? (
          <View className="py-24 items-center">
            <ActivityIndicator color="#111827" />
          </View>
        ) : addresses.length ? (
          <View className="gap-4">{addresses.map(renderAddress)}</View>
        ) : (
          <Card padding="lg" className="gap-3">
            <Text className="text-[#0f172a] font-geist-semibold text-[15px]">No addresses yet</Text>
            <Text className="text-[#475569] text-[13px]">Save a shipping or pickup location to speed up checkout.</Text>
            <Button variant="outline" onPress={handleAddNew}>
              Add your first address
            </Button>
          </Card>
        )}
      </View>
    </ScrollView>
  )
}

function cleanAddressLine(line?: string | null) {
  if (!line) return null
  if (!line.includes(ADDRESS_METADATA_PREFIX)) return line
  return (
    line
      .split("•")
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith(ADDRESS_METADATA_PREFIX))
      .join(" • ")
      .trim() || null
  )
}

function buildLines(address: CustomerAddress): string[] {
  const parts: string[] = []
  const name = [address.firstName, address.lastName].filter(Boolean).join(" ")
  if (name) parts.push(name)
  if (address.company) parts.push(address.company)
  if (address.address1) parts.push(address.address1)
  const address2 = stripAddressMetadata(address.address2)
  if (address2) parts.push(address2)
  const cityLine = [address.city, address.province, address.zip].filter(Boolean).join(", ")
  if (cityLine) parts.push(cityLine)
  if (address.country) parts.push(address.country)
  if (address.phoneNumber) parts.push(address.phoneNumber)
  return parts
}
