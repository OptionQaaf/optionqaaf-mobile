import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { ensureForYouProfileOnLogin, getForYouProfile, needsGenderPrompt, setGender } from "@/features/for-you/service"
import { qk } from "@/lib/shopify/queryKeys"
import { currentLocale } from "@/store/prefs"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native"

export function GenderPromptGate() {
  const qc = useQueryClient()
  const locale = currentLocale()
  const { isAuthenticated } = useShopifyAuth()
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selection, setSelection] = useState<"male" | "female" | null>(null)
  const dismissedForSessionRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setVisible(false)
      dismissedForSessionRef.current = false
      return
    }
    if (dismissedForSessionRef.current) return

    let active = true
    ;(async () => {
      await ensureForYouProfileOnLogin()
      const profile = await getForYouProfile()
      const shouldPrompt = await needsGenderPrompt(profile)
      if (!active) return
      setSelection(null)
      setVisible(shouldPrompt)
    })().catch(() => {
      if (active) setVisible(false)
    })

    return () => {
      active = false
    }
  }, [isAuthenticated])

  const persistSelection = async (gender: "male" | "female") => {
    setSaving(true)
    try {
      await setGender(gender)
      await qc.invalidateQueries({ queryKey: qk.forYou.profile(locale) as any })
      await qc.invalidateQueries({ queryKey: ["for-you", "products"] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-end bg-black/35">
        <Pressable
          className="flex-1"
          accessibilityLabel="Gender prompt backdrop"
          onPress={() => {}}
        />

        <View className="rounded-t-[28px] bg-white px-5 pt-6 pb-8 gap-4">
          <Text className="text-[20px] font-geist-semibold text-primary">Choose your shopping profile</Text>
          <Text className="text-[14px] text-secondary">This helps personalize your For You products.</Text>

          <View className="flex-row gap-3">
            <Pressable
              disabled={saving}
              className={`flex-1 rounded-2xl border px-4 py-3 items-center ${
                selection === "male" ? "border-black bg-black/5" : "border-gray-300"
              }`}
              onPress={() => setSelection("male")}
            >
              <Text className="text-primary font-geist-medium">Male</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              className={`flex-1 rounded-2xl border px-4 py-3 items-center ${
                selection === "female" ? "border-black bg-black/5" : "border-gray-300"
              }`}
              onPress={() => setSelection("female")}
            >
              <Text className="text-primary font-geist-medium">Female</Text>
            </Pressable>
          </View>

          <Pressable
            disabled={!selection || saving}
            className={`rounded-2xl px-4 py-3 items-center ${!selection || saving ? "bg-gray-300" : "bg-black"}`}
            onPress={() => {
              if (!selection) return
              setVisible(false)
              setTimeout(() => {
                void persistSelection(selection)
              }, 0)
            }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-geist-medium">Done</Text>}
          </Pressable>

        </View>
      </View>
    </Modal>
  )
}
