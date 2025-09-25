import { useCustomerAddresses, useDeleteAddress, useSetDefaultAddress } from "@/features/account/api"
import { useCustomerSession } from "@/features/account/session"
import type { AddressNode } from "@/lib/shopify/types/customer"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Muted, Text } from "@/ui/primitives/Typography"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { useToast } from "@/ui/feedback/Toast"
import { router } from "expo-router"
import { useMemo } from "react"
import { ActivityIndicator, Alert, View } from "react-native"
import { CheckCircle2, Edit3, MapPin, Star, Trash2 } from "lucide-react-native"

export default function AccountAddresses() {
  const isAuthenticated = !!useCustomerSession((s) => s.accessToken)
  const toast = useToast()
  const { data, isLoading, isRefetching, refetch } = useCustomerAddresses({ enabled: isAuthenticated, pageSize: 50 })
  const deleteMutation = useDeleteAddress()
  const defaultMutation = useSetDefaultAddress()

  const addresses = useMemo<AddressNode[]>(() => data?.customer?.addresses ?? [], [data?.customer?.addresses])
  const defaultId = useMemo(() => addresses.find((addr) => addr.isDefault)?.id, [addresses])

  const isBusy = isLoading || isRefetching || deleteMutation.isPending || defaultMutation.isPending

  const handleAdd = () => router.push("/account/address/new" as const)
  const handleEdit = (id: string) => router.push({ pathname: "/account/address/[id]", params: { id } })

  const handleDelete = (id: string) => {
    Alert.alert("Delete address", "Are you sure you want to remove this address?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(id)
            toast.show({ title: "Address removed", type: "success" })
            await refetch()
          } catch (err: any) {
            toast.show({ title: err?.message || "Couldn’t delete address", type: "danger" })
          }
        },
      },
    ])
  }

  const handleMakeDefault = async (id: string) => {
    if (id === defaultId) return
    try {
      await defaultMutation.mutateAsync(id)
      toast.show({ title: "Default address updated", type: "success" })
      await refetch()
    } catch (err: any) {
      toast.show({ title: err?.message || "Couldn’t update address", type: "danger" })
    }
  }

  if (!isAuthenticated) {
    return (
      <Screen>
        <MenuBar variant="light" back />
        <View className="flex-1 items-center justify-center px-6 gap-4">
          <Text className="text-[20px] font-geist-semibold">Sign in to manage addresses</Text>
          <Muted className="text-center text-[15px]">
            You need to sign in to view and update your saved shipping information.
          </Muted>
          <Button onPress={() => router.push("/account" as const)}>Go to account</Button>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <MenuBar variant="light" back />
      <PageScrollView contentContainerClassName="pb-12" isFooterHidden>
        <View className="px-5 pt-6 pb-10 gap-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-[22px] font-geist-semibold">Saved addresses</Text>
            <Button size="sm" onPress={handleAdd} leftIcon={<MapPin size={16} color="#fff" />}>
              Add new
            </Button>
          </View>

          {isLoading ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color="#0B0B0B" />
            </View>
          ) : addresses.length === 0 ? (
            <View className="rounded-3xl border border-dashed border-[#E5E5E5] bg-[#FCFCFC] p-6 items-center gap-3">
              <Text className="text-[17px] font-geist-semibold">No saved addresses</Text>
              <Muted className="text-center text-[15px]">Add a shipping address to use during checkout.</Muted>
              <Button onPress={handleAdd} variant="outline" leftIcon={<MapPin size={16} color="#0B0B0B" />}>
                Add address
              </Button>
            </View>
          ) : (
            <View className="gap-4">
              {addresses.map((address) => (
                <AddressItem
                  key={address.id}
                  address={address}
                  isDefault={address.isDefault ?? address.id === defaultId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onMakeDefault={handleMakeDefault}
                />
              ))}
            </View>
          )}

          {isBusy ? (
            <View className="flex-row items-center justify-center gap-2 pt-2">
              <ActivityIndicator size="small" color="#0B0B0B" />
              <Muted>Updating...</Muted>
            </View>
          ) : null}
        </View>
      </PageScrollView>
    </Screen>
  )
}

type AddressItemProps = {
  address: AddressNode
  isDefault: boolean
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onMakeDefault: (id: string) => void
}

function AddressItem({ address, isDefault, onEdit, onDelete, onMakeDefault }: AddressItemProps) {
  return (
    <View className="rounded-3xl border border-[#F0F0F0] bg-white p-5 gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <MapPin size={18} color="#0B0B0B" />
          <Text className="text-[16px] font-geist-semibold">
            {address.firstName} {address.lastName}
          </Text>
        </View>
        {isDefault ? (
          <View className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-[#FFE4EC]">
            <Star size={14} color="#FF3366" fill="#FF3366" />
            <Text className="text-[12px] font-geist-medium" style={{ color: "#FF3366" }}>
              Default
            </Text>
          </View>
        ) : null}
      </View>

      {address.formatted?.map((line, idx) => (
        <Muted key={idx} className="text-[14px]">
          {line}
        </Muted>
      ))}
      {address.phone ? <Muted className="text-[14px]">{address.phone}</Muted> : null}

      <View className="flex-row items-center justify-between pt-3">
        <View className="flex-row gap-2">
          <PressableOverlay
            onPress={() => onEdit(address.id)}
            className="flex-row items-center gap-2 rounded-2xl bg-[#F5F5F5] px-3 py-2"
          >
            <Edit3 size={16} color="#0B0B0B" />
            <Text className="text-[14px] font-geist-medium">Edit</Text>
          </PressableOverlay>
          {!isDefault ? (
            <PressableOverlay
              onPress={() => onMakeDefault(address.id)}
              className="flex-row items-center gap-2 rounded-2xl bg-[#F5F5F5] px-3 py-2"
            >
              <CheckCircle2 size={16} color="#0B0B0B" />
              <Text className="text-[14px] font-geist-medium">Set default</Text>
            </PressableOverlay>
          ) : null}
        </View>
        <PressableOverlay onPress={() => onDelete(address.id)} className="rounded-2xl bg-[#FFF1F1] px-3 py-2">
          <View className="flex-row items-center gap-2">
            <Trash2 size={16} color="#E11D48" />
            <Text className="text-[14px] text-[#E11D48] font-geist-medium">Remove</Text>
          </View>
        </PressableOverlay>
      </View>
    </View>
  )
}
