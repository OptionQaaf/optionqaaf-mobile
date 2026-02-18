import { useEffect, useState, type ReactElement } from "react"
import { Modal, Text, View } from "react-native"
import { isOnboardingDone } from "@/lib/storage/flags"
import { Button } from "@/ui/primitives/Button"
import { useFypGenderStore } from "@/features/fyp/genderStore"
import type { Gender } from "@/features/fyp/fypStorage"

export function useShouldShowGenderPopup(enabled: boolean): boolean {
  const gender = useFypGenderStore((state) => state.gender)
  const hasHydrated = useFypGenderStore((state) => state.hasHydrated)
  const forceShowPopup = useFypGenderStore((state) => state.forceShowPopup)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true
    isOnboardingDone()
      .then((done) => {
        if (!active) return
        setOnboardingDone(done)
        setChecked(true)
      })
      .catch(() => {
        if (!active) return
        setChecked(true)
      })

    return () => {
      active = false
    }
  }, [])

  if (!enabled) return false
  if (!hasHydrated) return false
  if (forceShowPopup) return true
  if (!checked) return false
  return onboardingDone && gender === "unknown"
}

type FypGenderPopupProps = {
  enabled: boolean
}

export function FypGenderPopup({ enabled }: FypGenderPopupProps): ReactElement | null {
  const shouldShow = useShouldShowGenderPopup(enabled)
  const setGender = useFypGenderStore((state) => state.setGender)
  const clearPopupTrigger = useFypGenderStore((state) => state.clearPopupTrigger)

  const handleSelect = (gender: Gender) => {
    if (gender === "unknown") return
    setGender(gender)
    clearPopupTrigger()
  }

  return (
    <Modal transparent animationType="fade" visible={shouldShow} onRequestClose={() => {}}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="gap-5 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
          <View className="gap-2">
            <Text className="text-center font-geist-semibold text-[20px] text-[#0f172a]">Set your FYP profile</Text>
            <Text className="text-center text-[14px] leading-[20px] text-[#475569]">
              Select the feed you want to start with.
            </Text>
          </View>
          <View className="gap-3">
            <Button size="lg" fullWidth onPress={() => handleSelect("male")}>
              Male
            </Button>
            <Button size="lg" fullWidth variant="outline" onPress={() => handleSelect("female")}>
              Female
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  )
}
