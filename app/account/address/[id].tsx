import { useCreateAddress, useCustomerAddresses, useSetDefaultAddress, useUpdateAddress } from "@/features/account/api"
import { useCustomerSession } from "@/features/account/session"
import type { AddressNode } from "@/lib/shopify/types/customer"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Muted, Text } from "@/ui/primitives/Typography"
import { useToast } from "@/ui/feedback/Toast"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Switch, View } from "react-native"

const EMPTY_ADDRESS = {
  firstName: "",
  lastName: "",
  address1: "",
  address2: "",
  city: "",
  province: "",
  zip: "",
  country: "",
  phone: "",
}

export default function AddressEditor() {
  const params = useLocalSearchParams<{ id?: string }>()
  const addressId = typeof params.id === "string" ? params.id : undefined
  const isNew = !addressId || addressId === "new"

  const isAuthenticated = !!useCustomerSession((s) => s.accessToken)
  const toast = useToast()

  const { data, isLoading } = useCustomerAddresses({ enabled: isAuthenticated, pageSize: 50 })
  const createMutation = useCreateAddress()
  const updateMutation = useUpdateAddress()
  const defaultMutation = useSetDefaultAddress()

  const addresses = useMemo<AddressNode[]>(() => {
    const edges = data?.customer?.addresses?.edges ?? []
    return edges.map((edge) => edge?.node).filter(Boolean) as AddressNode[]
  }, [data?.customer?.addresses?.edges])
  const defaultId = data?.customer?.defaultAddress?.id

  const existing = useMemo(() => addresses.find((node) => node.id === addressId), [addresses, addressId])

  const [form, setForm] = useState(() => ({ ...EMPTY_ADDRESS }))
  const [makeDefault, setMakeDefault] = useState<boolean>(false)

  useEffect(() => {
    if (isNew) {
      setForm((prev) => ({ ...prev, country: prev.country || "SA" }))
      setMakeDefault(!defaultId)
      return
    }
    if (existing) {
      setForm({
        firstName: existing.firstName ?? "",
        lastName: existing.lastName ?? "",
        address1: existing.address1 ?? "",
        address2: existing.address2 ?? "",
        city: existing.city ?? "",
        province: existing.province ?? "",
        zip: existing.zip ?? "",
        country: existing.country ?? "",
        phone: existing.phone ?? "",
      })
      setMakeDefault(existing.id === defaultId)
    }
  }, [isNew, existing, defaultId])

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saving = createMutation.isPending || updateMutation.isPending || defaultMutation.isPending

  if (!isAuthenticated) {
    return (
      <Screen>
        <MenuBar variant="light" back />
        <View className="flex-1 items-center justify-center px-6 gap-4">
          <Text className="text-[20px] font-geist-semibold">Sign in required</Text>
          <Muted className="text-center text-[15px]">Sign in to add or edit your saved shipping addresses.</Muted>
          <Button onPress={() => router.push("/account" as const)}>Go to account</Button>
        </View>
      </Screen>
    )
  }

  if (!isNew && isLoading && !existing) {
    return (
      <Screen>
        <MenuBar variant="light" back />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0B0B0B" />
        </View>
      </Screen>
    )
  }

  const onSave = async () => {
    if (!form.firstName || !form.address1 || !form.city || !form.country) {
      toast.show({ title: "Please fill in all required fields", type: "danger" })
      return
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      address1: form.address1.trim(),
      address2: form.address2.trim() || undefined,
      city: form.city.trim(),
      province: form.province.trim() || undefined,
      zip: form.zip.trim() || undefined,
      country: form.country.trim(),
      phone: form.phone.trim() || undefined,
    }

    try {
      if (isNew) {
        const created = await createMutation.mutateAsync(payload)
        const createdId = created?.id
        if (makeDefault && createdId) await defaultMutation.mutateAsync(createdId)
        toast.show({ title: "Address added", type: "success" })
      } else if (addressId) {
        await updateMutation.mutateAsync({ id: addressId, address: payload })
        if (makeDefault && addressId !== defaultId) await defaultMutation.mutateAsync(addressId)
        toast.show({ title: "Address updated", type: "success" })
      }
      router.back()
    } catch (err: any) {
      toast.show({ title: err?.message || "Couldn’t save address", type: "danger" })
    }
  }

  return (
    <Screen>
      <MenuBar variant="light" back />
      <PageScrollView contentContainerClassName="pb-12">
        <View className="px-5 pt-6 pb-10 gap-6">
          <View className="gap-1">
            <Text className="text-[22px] font-geist-semibold">{isNew ? "Add address" : "Edit address"}</Text>
            <Muted className="text-[15px]">
              {isNew ? "Save your shipping address for faster checkout." : "Update the details for this saved address."}
            </Muted>
          </View>

          <View className="gap-4">
            <View className="flex-row gap-3">
              <Input
                label="First name"
                value={form.firstName}
                onChangeText={(text) => updateField("firstName", text)}
                className="flex-1"
              />
              <Input
                label="Last name"
                value={form.lastName}
                onChangeText={(text) => updateField("lastName", text)}
                className="flex-1"
              />
            </View>
            <Input
              label="Address line 1"
              value={form.address1}
              onChangeText={(text) => updateField("address1", text)}
            />
            <Input
              label="Address line 2"
              value={form.address2}
              onChangeText={(text) => updateField("address2", text)}
            />
            <Input label="City" value={form.city} onChangeText={(text) => updateField("city", text)} />
            <View className="flex-row gap-3">
              <Input
                label="State / Province"
                value={form.province}
                onChangeText={(text) => updateField("province", text)}
                className="flex-1"
              />
              <Input
                label="Postal code"
                value={form.zip}
                onChangeText={(text) => updateField("zip", text)}
                className="flex-1"
              />
            </View>
            <Input
              label="Country"
              value={form.country}
              onChangeText={(text) => updateField("country", text)}
              helper="Use the full country name or ISO code (e.g. Saudi Arabia)."
            />
            <Input
              label="Phone"
              value={form.phone}
              onChangeText={(text) => updateField("phone", text)}
              keyboardType="phone-pad"
            />
          </View>

          <View className="flex-row items-center justify-between rounded-2xl border border-[#EFEFEF] bg-white px-4 py-3">
            <View className="flex-1 pr-4">
              <Text className="text-[16px] font-geist-medium">Set as default shipping address</Text>
              <Muted className="text-[13px]">This address will be used automatically during checkout.</Muted>
            </View>
            <Switch value={makeDefault} onValueChange={setMakeDefault} />
          </View>

          <Button onPress={onSave} isLoading={saving}>
            {isNew ? "Save address" : "Update address"}
          </Button>
        </View>
      </PageScrollView>
    </Screen>
  )
}
