import { GENDER_OPTIONS, type GenderChoice } from "@/lib/personalization/gender"
import { useGenderService } from "@/features/personalization/useGenderService"
import { Button } from "@/ui/primitives/Button"
import { Modal, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type GenderChoiceHostProps = {
  enabled: boolean
}

const GENDER_LABELS: Record<GenderChoice, string> = {
  male: "Male",
  female: "Female",
}

export function GenderChoiceHost({ enabled }: GenderChoiceHostProps) {
  const insets = useSafeAreaInsets()
  const { visible, saving, chooseGender } = useGenderService({ enabled })

  if (!visible) return null

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => {}}>
      <View className="flex-1 justify-end bg-black/40">
        <View
          className="gap-4 rounded-t-[24px] bg-white px-5 pt-5"
          style={{ paddingBottom: Math.max(20, insets.bottom + 8) }}
        >
          <View className="gap-2">
            <Text className="text-[18px] font-geist-semibold text-[#0f172a]">Select your gender</Text>
            <Text className="text-[13px] leading-[19px] text-[#475569]">
              We use this to personalize your shopping feed. You can change it later.
            </Text>
          </View>

          <View className="gap-3">
            {GENDER_OPTIONS.map((option) => (
              <Button
                key={option}
                size="md"
                fullWidth
                variant="outline"
                onPress={() => {
                  void chooseGender(option)
                }}
                isLoading={saving === option}
              >
                {GENDER_LABELS[option]}
              </Button>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}
