import { useCustomerOverview, useUpdateCustomerProfile } from "@/features/account/api"
import { useCustomerSession } from "@/features/account/session"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Muted, Text } from "@/ui/primitives/Typography"
import { useToast } from "@/ui/feedback/Toast"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"

const EMPTY_PROFILE = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
}

export default function AccountProfile() {
  const isAuthenticated = !!useCustomerSession((s) => s.accessToken)
  const toast = useToast()
  const { data, isLoading, isRefetching, refetch } = useCustomerOverview({ enabled: isAuthenticated })
  const updateProfile = useUpdateCustomerProfile()

  const [form, setForm] = useState(() => ({ ...EMPTY_PROFILE }))

  useEffect(() => {
    const customer = data?.customer
    if (!customer) return
    setForm({
      firstName: customer.firstName ?? "",
      lastName: customer.lastName ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
    })
  }, [data?.customer])

  const setField = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const saving = updateProfile.isPending
  const busy = isLoading || isRefetching

  if (!isAuthenticated) {
    return (
      <Screen>
        <MenuBar variant="light" back />
        <View className="flex-1 items-center justify-center px-6 gap-4">
          <Text className="text-[20px] font-geist-semibold">Sign in required</Text>
          <Muted className="text-center text-[15px]">Sign in to update your OptionQaaf account details.</Muted>
          <Button onPress={() => router.push("/account" as const)}>Go to account</Button>
        </View>
      </Screen>
    )
  }

  const onSave = async () => {
    if (!form.email) {
      toast.show({ title: "Email is required", type: "danger" })
      return
    }
    try {
      await updateProfile.mutateAsync({
        email: form.email.trim(),
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
      })
      toast.show({ title: "Profile updated", type: "success" })
      refetch()
    } catch (err: any) {
      toast.show({ title: err?.message || "Couldn’t update profile", type: "danger" })
    }
  }

  return (
    <Screen>
      <MenuBar variant="light" back />
      <PageScrollView contentContainerClassName="pb-12" isFooterHidden>
        <View className="px-5 pt-6 pb-10 gap-6">
          <View className="gap-1">
            <Text className="text-[22px] font-geist-semibold">Account details</Text>
            <Muted className="text-[15px]">Update your personal information and contact details.</Muted>
          </View>

          {busy ? (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color="#0B0B0B" />
            </View>
          ) : (
            <View className="gap-4">
              <View className="flex-row gap-3">
                <Input
                  label="First name"
                  value={form.firstName}
                  onChangeText={(text) => setField("firstName", text)}
                  className="flex-1"
                />
                <Input
                  label="Last name"
                  value={form.lastName}
                  onChangeText={(text) => setField("lastName", text)}
                  className="flex-1"
                />
              </View>
              <Input
                label="Email"
                value={form.email}
                onChangeText={(text) => setField("email", text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="Phone"
                value={form.phone}
                onChangeText={(text) => setField("phone", text)}
                keyboardType="phone-pad"
              />
            </View>
          )}

          <Button onPress={onSave} isLoading={saving} disabled={busy}>
            Save changes
          </Button>
        </View>
      </PageScrollView>
    </Screen>
  )
}
