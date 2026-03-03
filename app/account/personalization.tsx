import { useCustomerProfile } from "@/features/account/api"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { isPushAdmin } from "@/features/notifications/admin"
import { birthDateFromDate, birthDateToDate, getDefaultBirthDateSelection } from "@/lib/personalization/birthDate"
import { resetBirthDatePromptStateForDev, triggerBirthDatePromptNowForDev } from "@/lib/personalization/birthDatePrompt"
import { type GenderChoice } from "@/lib/personalization/gender"
import {
  deleteCustomerBirthDate,
  fetchCustomerPersonalizationFacts,
  setCustomerBirthDate,
  setCustomerGender,
} from "@/lib/shopify/customer/personalization"
import { useAdminView } from "@/store/adminView"
import { usePersonalization } from "@/store/personalization"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { DOCK_HEIGHT } from "@/ui/nav/dockConstants"
import { Button } from "@/ui/primitives/Button"
import { Card } from "@/ui/surfaces/Card"
import { cn } from "@/ui/utils/cva"
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native"
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
  const localBirthDate = usePersonalization((state) => state.birthDate)
  const viewAsNonAdmin = useAdminView((state) => state.viewAsNonAdmin)
  const setLocalGender = usePersonalization((state) => state.setGender)
  const setLocalBirthDate = usePersonalization((state) => state.setBirthDate)
  const { show } = useToast()

  const [selectedGender, setSelectedGender] = useState<GenderChoice | null>(localGender)
  const [selectedBirthDate, setSelectedBirthDate] = useState<string | null>(localBirthDate)
  const [birthDateDraft, setBirthDateDraft] = useState<Date>(
    () => birthDateToDate(localBirthDate) ?? getDefaultBirthDateSelection(),
  )
  const [birthDateManuallyChosen, setBirthDateManuallyChosen] = useState(false)
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingBirthDate, setSavingBirthDate] = useState(false)
  const bottomPadding = insets.bottom + DOCK_HEIGHT + 24
  const draftBirthDateValue = birthDateFromDate(birthDateDraft)
  const hasBirthDateChanges = localBirthDate ? draftBirthDateValue !== localBirthDate : birthDateManuallyChosen
  const birthDateLabel = selectedBirthDate
    ? (birthDateToDate(selectedBirthDate)?.toDateString() ?? selectedBirthDate)
    : birthDateManuallyChosen
      ? birthDateDraft.toDateString()
      : "Not set yet"
  const isAdmin = useMemo(() => isPushAdmin(profile?.email) && !viewAsNonAdmin, [profile?.email, viewAsNonAdmin])

  useEffect(() => {
    setSelectedGender(localGender)
  }, [localGender])

  useEffect(() => {
    setSelectedBirthDate(localBirthDate)
    setBirthDateManuallyChosen(false)
    const parsed = birthDateToDate(localBirthDate)
    if (parsed) {
      setBirthDateDraft(parsed)
    }
  }, [localBirthDate])

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    const syncFromRemote = async () => {
      try {
        const facts = await fetchCustomerPersonalizationFacts()
        if (cancelled) return
        if (facts.gender) {
          setLocalGender(facts.gender)
          setSelectedGender(facts.gender)
        }
        if (facts.birthDate) {
          setLocalBirthDate(facts.birthDate)
          setSelectedBirthDate(facts.birthDate)
          const parsed = birthDateToDate(facts.birthDate)
          if (parsed) {
            setBirthDateDraft(parsed)
          }
        }
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[personalization] Failed loading customer personalization in settings", error)
        }
      }
    }

    void syncFromRemote()

    return () => {
      cancelled = true
    }
  }, [profile?.id, setLocalBirthDate, setLocalGender])

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

  const handleBirthDateChange = useCallback(
    (event: DateTimePickerEvent, next?: Date) => {
      if (Platform.OS === "android") {
        setShowBirthDatePicker(false)
      }
      if (event.type === "dismissed") return
      if (!next) return
      setBirthDateDraft(next)
      setBirthDateManuallyChosen(true)
      if (selectedBirthDate) {
        setSelectedBirthDate(birthDateFromDate(next))
      }
    },
    [selectedBirthDate],
  )

  const handleSaveBirthDate = useCallback(async () => {
    if (!profile?.id || savingBirthDate) return
    const nextBirthDate = birthDateFromDate(birthDateDraft)

    setSavingBirthDate(true)
    try {
      setLocalBirthDate(nextBirthDate)
      setSelectedBirthDate(nextBirthDate)
      setBirthDateManuallyChosen(false)
      await setCustomerBirthDate(nextBirthDate, profile.id)
      show({ title: "Birth date updated", type: "success" })
    } catch (error: any) {
      const message = error?.message || "Could not update birth date."
      show({ title: message, type: "danger" })
    } finally {
      setSavingBirthDate(false)
    }
  }, [birthDateDraft, profile?.id, savingBirthDate, setLocalBirthDate, show])

  const handleResetBirthDateDev = useCallback(async () => {
    setLocalBirthDate(null)
    setSelectedBirthDate(null)
    setBirthDateDraft(getDefaultBirthDateSelection())
    setBirthDateManuallyChosen(false)
    resetBirthDatePromptStateForDev()

    if (profile?.id) {
      try {
        await deleteCustomerBirthDate(profile.id)
        const facts = await fetchCustomerPersonalizationFacts()
        if (facts.birthDate) {
          throw new Error("Birth date still exists on Shopify.")
        }
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[birth-date] Failed deleting customer birth date in dev reset", error)
        }
        const message = error instanceof Error ? error.message : "Could not remove remote birth date."
        show({ title: message, type: "danger" })
        return
      }
    }

    show({ title: "Birth date reset", type: "info" })
  }, [profile?.id, setLocalBirthDate, show])

  const handleShowPopupNowDev = useCallback(async () => {
    setLocalBirthDate(null)
    setSelectedBirthDate(null)
    setBirthDateDraft(getDefaultBirthDateSelection())
    setBirthDateManuallyChosen(false)

    if (profile?.id) {
      try {
        await deleteCustomerBirthDate(profile.id)
        const facts = await fetchCustomerPersonalizationFacts()
        if (facts.birthDate) {
          throw new Error("Birth date still exists on Shopify.")
        }
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[birth-date] Failed deleting customer birth date before forcing popup", error)
        }
        const message = error instanceof Error ? error.message : "Could not remove remote birth date."
        show({ title: message, type: "danger" })
        return
      }
    }

    triggerBirthDatePromptNowForDev()
    if (localBirthDate === null) {
      setLocalBirthDate("2000-01-01")
      setTimeout(() => setLocalBirthDate(null), 0)
    }
    show({ title: "Birth date popup will show now", type: "info" })
  }, [localBirthDate, profile?.id, setLocalBirthDate, show])

  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingTop: 52, paddingBottom: bottomPadding }}
        scrollIndicatorInsets={{ top: 52, bottom: bottomPadding }}
        className="flex-1 bg-white"
      >
        <View className="px-5 pt-6 gap-6">
          <View className="gap-2">
            <Text className="text-[#0f172a] font-geist-semibold text-[22px]">Personalization</Text>
            <Text className="text-[#475569] text-[14px] leading-[20px]">
              Manage your profile preferences. More personalization settings will appear here.
            </Text>
          </View>

          <Card padding="sm" className="gap-4">
            <View className="gap-1">
              <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Gender</Text>
              <Text className="text-[#475569] text-[13px] leading-[18px]">
                Used to personalize your product feed and future recommendations.
              </Text>
            </View>

            <View className="gap-3 flex-row">
              {GENDER_SELECTIONS.map((option) => {
                const active = selectedGender === option.id
                return (
                  <PressableOverlay
                    key={option.id}
                    haptic="light"
                    pressableClassName="flex-1"
                    className={cn(
                      "items-center justify-center rounded-sm border px-3 py-3",
                      active ? "border-brand bg-brand/10" : "border-[#E6E6E6] bg-white",
                    )}
                    onPress={() => setSelectedGender(option.id)}
                  >
                    <Text className={cn("text-[15px] font-semibold", active ? "text-brand" : "text-primary")}>
                      {option.label}
                    </Text>
                  </PressableOverlay>
                )
              })}
            </View>

            <Button
              size="md"
              fullWidth
              onPress={handleSave}
              isLoading={saving}
              disabled={!selectedGender || !hasChanges}
            >
              Save preferences
            </Button>
          </Card>

          <Card padding="sm" className="gap-4">
            <View className="gap-1">
              <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Birth date</Text>
              <Text className="text-[#475569] text-[13px] leading-[18px]">
                Used for birthday gifts and more personalized customer experiences.
              </Text>
            </View>

            <View className="w-full gap-2">
              <PressableOverlay
                haptic="light"
                className="w-full rounded-sm border border-border bg-surface px-4 py-4"
                onPress={() => setShowBirthDatePicker(true)}
              >
                <Text className="text-[14px] text-[#0f172a]">{birthDateLabel}</Text>
              </PressableOverlay>
            </View>

            <Button
              size="md"
              fullWidth
              onPress={handleSaveBirthDate}
              isLoading={savingBirthDate}
              disabled={!hasBirthDateChanges}
            >
              {selectedBirthDate ? "Update birth date" : "Save birth date"}
            </Button>
          </Card>

          {__DEV__ && isAdmin ? (
            <Card padding="sm" className="gap-3">
              <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Admin dev tools</Text>
              <Button size="md" variant="outline" fullWidth onPress={() => void handleResetBirthDateDev()}>
                Reset birth date (dev)
              </Button>
              <Button size="md" variant="outline" fullWidth onPress={() => void handleShowPopupNowDev()}>
                Show birth date popup now (dev)
              </Button>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={showBirthDatePicker}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowBirthDatePicker(false)}
      >
        <View className="flex-1 justify-end bg-transparent">
          <Pressable className="flex-1" onPress={() => setShowBirthDatePicker(false)} />
          <View className="gap-3 rounded-t-md bg-white px-5 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-geist-semibold text-[#0f172a]">Select birth date</Text>
              <Button variant="ghost" size="sm" onPress={() => setShowBirthDatePicker(false)}>
                Done
              </Button>
            </View>

            <View className="w-full items-center justify-center">
              <DateTimePicker
                value={birthDateDraft}
                mode="date"
                display="spinner"
                onChange={handleBirthDateChange}
                maximumDate={new Date()}
                themeVariant="light"
                style={{ width: "100%" }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}
