import {
  birthDateFromDate,
  birthDateToDate,
  getDefaultBirthDateSelection,
  type BirthDateValue,
} from "@/lib/personalization/birthDate"
import { useBirthDateService } from "@/features/personalization/useBirthDateService"
import { Button } from "@/ui/primitives/Button"
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker"
import { useEffect, useState } from "react"
import { Modal, Platform, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type BirthDatePromptHostProps = {
  enabled: boolean
}

export function BirthDatePromptHost({ enabled }: BirthDatePromptHostProps) {
  const insets = useSafeAreaInsets()
  const { visible, saving, birthDate, chooseBirthDate, dismissPrompt } = useBirthDateService({ enabled })
  const [selectedDate, setSelectedDate] = useState<Date>(
    () => birthDateToDate(birthDate) ?? getDefaultBirthDateSelection(),
  )

  useEffect(() => {
    const parsed = birthDateToDate(birthDate)
    if (parsed) {
      setSelectedDate(parsed)
    }
  }, [birthDate])

  const onDateChange = (_event: DateTimePickerEvent, next?: Date) => {
    if (!next) return
    setSelectedDate(next)
  }

  if (!visible) return null

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismissPrompt}>
      <View className="flex-1 justify-end bg-black/40">
        <View
          className="gap-4 rounded-t-[24px] bg-white px-5 pt-5"
          style={{ paddingBottom: Math.max(20, insets.bottom + 8) }}
        >
          <View className="gap-2">
            <Text className="text-[18px] font-geist-semibold text-[#0f172a]">Add your birth date</Text>
            <Text className="text-[13px] leading-[19px] text-[#475569]">
              We use this for birthday gifts and personalized offers.
            </Text>
          </View>

          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "calendar"}
            onChange={onDateChange}
            maximumDate={new Date()}
            themeVariant="light"
          />

          <View className="gap-3">
            <Button
              size="md"
              fullWidth
              onPress={() => {
                const next = birthDateFromDate(selectedDate) as BirthDateValue
                void chooseBirthDate(next)
              }}
              isLoading={saving !== null}
            >
              Save birth date
            </Button>
            <Button size="md" variant="outline" fullWidth onPress={dismissPrompt} disabled={saving !== null}>
              Not now
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  )
}
