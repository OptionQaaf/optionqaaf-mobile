import { avatarFromNames } from "@/features/account/avatar"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { useCustomerProfile, useUpdateCustomerProfile } from "@/features/account/api"
import { AuthGate } from "@/features/auth/AuthGate"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Input } from "@/ui/primitives/Input"
import { Button } from "@/ui/primitives/Button"
import { useRouter } from "expo-router"
import { RotateCcw } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, ScrollView, Text, View } from "react-native"

export default function AccountEditScreen() {
  const router = useRouter()

  return (
    <AuthGate requireAuth fallback={<AccountSignInFallback onSuccess={() => router.replace("/account" as const)} />}>
      <Screen bleedBottom>
        <MenuBar back />
        <EditProfileContent />
      </Screen>
    </AuthGate>
  )
}

function EditProfileContent() {
  const { data: profile, isLoading } = useCustomerProfile()
  const { mutateAsync, isPending } = useUpdateCustomerProfile()
  const { show } = useToast()
  const router = useRouter()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  useEffect(() => {
    if (!profile) return
    setFirstName(profile.firstName ?? "")
    setLastName(profile.lastName ?? "")
  }, [profile])

  const trimmedFirst = firstName.trim()
  const trimmedLast = lastName.trim()

  const hasChanges = useMemo(() => {
    if (!profile) return false
    const originalFirst = profile.firstName?.trim() ?? ""
    const originalLast = profile.lastName?.trim() ?? ""
    return trimmedFirst !== originalFirst || trimmedLast !== originalLast
  }, [profile, trimmedFirst, trimmedLast])

  const avatar = useMemo(() => {
    const fallbackName = profile?.displayName || profile?.email || "Guest"
    const nextFirst = profile ? trimmedFirst || profile.firstName : trimmedFirst || ""
    const nextLast = profile ? trimmedLast || profile.lastName : trimmedLast || ""
    return avatarFromNames(nextFirst || null, nextLast || null, fallbackName)
  }, [profile, trimmedFirst, trimmedLast])

  const handleSave = useCallback(async () => {
    try {
      await mutateAsync({
        firstName: trimmedFirst || null,
        lastName: trimmedLast || null,
      })
      show({ title: "Profile updated", type: "success" })
      router.back()
    } catch (err: any) {
      const message = err?.message || "Could not update profile."
      show({ title: message, type: "danger" })
    }
  }, [mutateAsync, trimmedFirst, trimmedLast, show, router])

  const handleReset = useCallback(() => {
    if (!profile) return
    setFirstName(profile.firstName ?? "")
    setLastName(profile.lastName ?? "")
  }, [profile])

  if (isLoading && !profile) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1 bg-[#f8fafc]">
      <View className="px-5 pt-6 gap-8">
        <View className="items-center gap-4">
          <View
            className="h-24 w-24 rounded-full items-center justify-center"
            style={{ backgroundColor: avatar.color }}
          >
            <Text className="text-white font-geist-semibold text-[28px]">{avatar.initials}</Text>
          </View>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw size={16} color="#0f172a" />}
              onPress={handleReset}
              disabled={!profile}
            >
              Reset
            </Button>
          </View>
        </View>

        <View className="gap-4">
          <Input
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            textContentType="givenName"
            placeholder="e.g. Layla"
          />
          <Input
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            textContentType="familyName"
            placeholder="e.g. Al-Faraj"
          />
        </View>

        <View className="gap-3">
          <Button fullWidth onPress={handleSave} isLoading={isPending} disabled={!hasChanges || isPending}>
            Save changes
          </Button>
          <Button variant="ghost" fullWidth onPress={() => router.back()}>
            Cancel
          </Button>
        </View>
      </View>
    </ScrollView>
  )
}
