import { useCustomerProfile } from "@/features/account/api"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useForYouProfile } from "@/features/for-you/api"
import { getForYouStorageDebugSnapshot, setGender } from "@/features/for-you/service"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { isPushAdmin } from "@/features/notifications/admin"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Card } from "@/ui/surfaces/Card"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, Text, View } from "react-native"

export default function ForYouSettingsScreen() {
  const router = useRouter()

  return (
    <AuthGate requireAuth fallback={<AccountSignInFallback onSuccess={() => router.replace("/account" as const)} />}>
      <Screen bleedBottom>
        <MenuBar back />
        <ForYouSettingsContent />
      </Screen>
    </AuthGate>
  )
}

function ForYouSettingsContent() {
  const { show } = useToast()
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated })
  const forYouQuery = useForYouProfile()
  const [saving, setSaving] = useState(false)
  const [storageSummary, setStorageSummary] = useState<string | null>(null)
  const [storageSnapshot, setStorageSnapshot] = useState<Awaited<ReturnType<typeof getForYouStorageDebugSnapshot>> | null>(null)

  const isAdmin = useMemo(() => isPushAdmin(profile?.email), [profile?.email])
  const selectedGender = forYouQuery.data?.gender ?? "unknown"

  useEffect(() => {
    let active = true
    ;(async () => {
      const snapshot = await getForYouStorageDebugSnapshot().catch(() => null)
      if (!active || !snapshot) return
      setStorageSnapshot(snapshot)
      if (snapshot.identity.isAuthenticated && snapshot.customerMetafieldHasProfile) {
        setStorageSummary("Stored in customer metafield + local cache")
        return
      }
      if (snapshot.identity.isAuthenticated) {
        setStorageSummary("Authenticated, local cache fallback")
        return
      }
      setStorageSummary("Guest local storage")
    })()
    return () => {
      active = false
    }
  }, [isAuthenticated, forYouQuery.data?.updatedAt])

  const updateGender = useCallback(
    async (gender: "male" | "female") => {
      if (selectedGender === gender) return
      setSaving(true)
      try {
        await setGender(gender)
        await forYouQuery.refetch()
        show({ title: "For You profile updated", type: "success" })
      } catch (err: any) {
        show({ title: err?.message || "Could not update For You profile", type: "danger" })
      } finally {
        setSaving(false)
      }
    },
    [forYouQuery, selectedGender, show],
  )

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1 bg-[#f8fafc]">
      <View className="px-5 pt-6 gap-6">
        <View className="gap-2">
          <Text className="text-[#0f172a] font-geist-semibold text-[22px]">For You profile</Text>
          <Text className="text-[#475569] text-[14px] leading-[20px]">
            Select which products you want prioritized in your For You feed.
          </Text>
        </View>

        <Card padding="lg" className="gap-4">
          <Text className="text-[#475569] text-[13px]">Gender</Text>

          <View className="flex-row gap-2">
            <Button
              size="md"
              variant={selectedGender === "male" ? "solid" : "outline"}
              className="flex-1"
              disabled={saving || forYouQuery.isFetching}
              onPress={() => updateGender("male")}
            >
              Male
            </Button>
            <Button
              size="md"
              variant={selectedGender === "female" ? "solid" : "outline"}
              className="flex-1"
              disabled={saving || forYouQuery.isFetching}
              onPress={() => updateGender("female")}
            >
              Female
            </Button>
          </View>
        </Card>

        {isAdmin ? (
          <Card padding="lg" className="gap-3">
            <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Admin details</Text>
            <View className="gap-1">
              <Text className="text-[#475569] text-[13px]">Storage</Text>
              <Text className="text-[#0f172a] text-[14px]">{storageSummary ?? "Unknown"}</Text>
            </View>
            <View className="gap-1">
              <Text className="text-[#475569] text-[13px]">Updated at</Text>
              <Text className="text-[#0f172a] text-[14px]">{forYouQuery.data?.updatedAt ?? "Unknown"}</Text>
            </View>
            <View className="gap-1">
              <Text className="text-[#475569] text-[13px]">Schema version</Text>
              <Text className="text-[#0f172a] text-[14px]">{forYouQuery.data?.schemaVersion ?? "Unknown"}</Text>
            </View>
            <View className="gap-1">
              <Text className="text-[#475569] text-[13px]">Identity</Text>
              <Text className="text-[#0f172a] text-[14px]">
                {storageSnapshot
                  ? `${storageSnapshot.identity.isAuthenticated ? "authenticated" : "guest"} (${storageSnapshot.identity.customerId ?? "no customer id"})`
                  : "Unknown"}
              </Text>
            </View>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  )
}
