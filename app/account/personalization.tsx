import { useCustomerProfile } from "@/features/account/api"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { type GenderChoice } from "@/lib/personalization/gender"
import { fetchCustomerGender, setCustomerGender } from "@/lib/shopify/customer/personalization"
import { usePersonalization } from "@/store/personalization"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { DOCK_HEIGHT } from "@/ui/nav/dockConstants"
import { Button } from "@/ui/primitives/Button"
import { Card } from "@/ui/surfaces/Card"
import { cn } from "@/ui/utils/cva"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type GenderOption = {
  id: GenderChoice
  label: string
}

const GENDER_SELECTIONS: GenderOption[] = [
  {
    id: "male",
    label: "Male",
  },
  {
    id: "female",
    label: "Female",
  },
]

export default function PersonalizationScreen() {
  const router = useRouter()

  return (
    <AuthGate requireAuth fallback={<AccountSignInFallback onSuccess={() => router.replace("/account" as const)} />}>
      <Screen bleedBottom>
        <PersonalizationContent />
      </Screen>
    </AuthGate>
  )
}

function PersonalizationContent() {
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated })
  const localGender = usePersonalization((state) => state.gender)
  const setLocalGender = usePersonalization((state) => state.setGender)
  const { show } = useToast()

  const [selectedGender, setSelectedGender] = useState<GenderChoice | null>(localGender)
  const [saving, setSaving] = useState(false)
  const bottomPadding = insets.bottom + DOCK_HEIGHT + 24

  useEffect(() => {
    if (localGender) {
      setSelectedGender(localGender)
    }
  }, [localGender])

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    const syncFromRemote = async () => {
      try {
        const remoteGender = await fetchCustomerGender()
        if (cancelled || !remoteGender) return
        setLocalGender(remoteGender)
        setSelectedGender(remoteGender)
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[gender] Failed loading customer gender in settings", error)
        }
      }
    }

    void syncFromRemote()

    return () => {
      cancelled = true
    }
  }, [profile?.id, setLocalGender])

  const hasChanges = useMemo(() => selectedGender !== localGender, [selectedGender, localGender])

  const handleSave = useCallback(async () => {
    if (!selectedGender || !profile?.id || saving) return

    setSaving(true)
    try {
      setLocalGender(selectedGender)
      await setCustomerGender(selectedGender, profile.id)
      show({ title: "Personalization updated", type: "success" })
    } catch (error: any) {
      const message = error?.message || "Could not update personalization."
      show({ title: message, type: "danger" })
    } finally {
      setSaving(false)
    }
  }, [profile?.id, saving, selectedGender, setLocalGender, show])

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 52, paddingBottom: bottomPadding }}
      scrollIndicatorInsets={{ top: 52, bottom: bottomPadding }}
      className="flex-1 bg-[#f8fafc]"
    >
      <View className="px-5 pt-6 gap-6">
        <View className="gap-2">
          <Text className="text-[#0f172a] font-geist-semibold text-[22px]">Personalization</Text>
          <Text className="text-[#475569] text-[14px] leading-[20px]">
            Manage your profile preferences. More personalization settings will appear here.
          </Text>
        </View>

        <Card padding="lg" className="gap-4">
          <View className="gap-1">
            <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Gender</Text>
            <Text className="text-[#475569] text-[13px] leading-[18px]">
              Used to personalize your product feed and future recommendations.
            </Text>
          </View>

          <View className="gap-3">
            {GENDER_SELECTIONS.map((option) => {
              const active = selectedGender === option.id
              return (
                <Button
                  key={option.id}
                  variant="outline"
                  size="md"
                  fullWidth
                  className={cn(active ? "border-brand bg-brand/10" : "")}
                  onPress={() => setSelectedGender(option.id)}
                >
                  {option.label}
                </Button>
              )
            })}
          </View>

          <Button size="md" fullWidth onPress={handleSave} isLoading={saving} disabled={!selectedGender || !hasChanges}>
            Save preferences
          </Button>
        </Card>
      </View>
    </ScrollView>
  )
}
