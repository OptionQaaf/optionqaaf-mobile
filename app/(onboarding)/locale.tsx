import type { CurrencyCode } from "@/features/currency/config"
import type { CountryCode } from "@/features/locale/countries"
import { COUNTRIES } from "@/features/locale/countries"
import { requestPushPermissionsAndToken } from "@/features/notifications/permissions"
import { markOnboardingDone } from "@/lib/storage/flags"
import { useNotificationSettings } from "@/store/notifications"
import { usePrefs, type LanguageCode } from "@/store/prefs"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { Screen } from "@/ui/layout/Screen"
import { Button } from "@/ui/primitives/Button"
import { H3, Muted } from "@/ui/primitives/Typography"
import { cn } from "@/ui/utils/cva"
import * as Notifications from "expo-notifications"
import { useRouter } from "expo-router"
import { Bell } from "lucide-react-native"
import { useCallback, useState } from "react"
import { Image, Modal, Pressable, Text as RNText, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export default function LocaleOnboarding() {
  const router = useRouter()
  const { setPrefs } = usePrefs()
  const { setPushPreference, pushEnabled } = useNotificationSettings()
  const { show } = useToast()

  const [language] = useState<LanguageCode>("EN")
  const [country, setCountry] = useState<CountryCode>("SA")
  const [currency, setCurrency] = useState<CurrencyCode>("SAR")
  const [showPushModal, setShowPushModal] = useState(false)

  const applyCountry = (c: CountryCode) => {
    setCountry(c)
    const match = COUNTRIES.find((x) => x.id === c)
    if (match) setCurrency(match.currency) // auto-set currency
  }

  const finishOnboarding = useCallback(async () => {
    await markOnboardingDone()
    router.replace("/home")
  }, [router])

  const handlePushSetup = useCallback(
    async (shouldToast: boolean) => {
      try {
        const result = await requestPushPermissionsAndToken()
        setPushPreference(result.granted, result.token ?? null)

        if (shouldToast) {
          if (result.granted) {
            show({ title: "Push notifications enabled", type: "success" })
          } else {
            show({ title: "Enable notifications anytime in Settings", type: "info" })
          }
        }
      } catch (err: any) {
        const message = err?.message ?? "Could not enable notifications."
        if (shouldToast) show({ title: message, type: "danger" })
        setPushPreference(false, null)
      }
    },
    [setPushPreference, show],
  )

  const handleEnablePush = useCallback(() => {
    setShowPushModal(false)
    void handlePushSetup(true)
    finishOnboarding().catch(() => {})
  }, [finishOnboarding, handlePushSetup])

  const handleSkipPush = useCallback(async () => {
    setPushPreference(false, null)
    setShowPushModal(false)
    await finishOnboarding()
  }, [finishOnboarding, setPushPreference])

  const handleContinue = useCallback(async () => {
    setPrefs({ language, country, currency })
    if (pushEnabled) {
      finishOnboarding().catch(() => {})
      return
    }

    try {
      const status = await Notifications.getPermissionsAsync()
      if (status.granted) {
        void handlePushSetup(false)
        finishOnboarding().catch(() => {})
        return
      }
    } catch {
      // fall through to showing modal
    }
    setShowPushModal(true)
  }, [country, currency, finishOnboarding, handlePushSetup, language, pushEnabled, setPrefs])

  return (
    <Screen bleedTop bleedBottom>
      <View className="relative max-h-[220px] min-h-[200px] w-full bg-black">
        <Image
          source={require("@/assets/images/hero-blur.png")}
          resizeMode="cover"
          className="absolute inset-0 opacity-60"
        />
        <View className="flex-1 items-center justify-center">
          <Image source={require("@/assets/images/optionqaaf-logo-white.png")} style={{ width: 220, height: 48 }} />
        </View>
      </View>

      {/* SHEET that fills remaining height */}
      <View className="flex-1 -mt-6 overflow-hidden rounded-t-[32px] bg-white">
        <PageScrollView isFooterHidden>
          <SafeAreaView className="flex-1 justify-between px-4 pt-8" edges={["bottom"]}>
            {/* FORM GROUP */}
            <View className="flex-col gap-4">
              {/* Country (pills grid; no FlatList) */}
              <View className="flex-col gap-4">
                <View>
                  <H3>Country / الدولة</H3>
                  <Muted className="text-md">Choose your country / اختر دولتك</Muted>
                </View>

                <View className="gap-2">
                  {COUNTRIES.map((c) => {
                    const active = country === c.id
                    return (
                      <PressableOverlay
                        haptic="light"
                        key={c.id}
                        onPress={() => applyCountry(c.id)}
                        className={cn(
                          "justify-center rounded-2xl border px-3 py-3",
                          active ? "border-brand bg-brand/10" : "border-[#E6E6E6] bg-white",
                        )}
                      >
                        <View className="flex-row items-center justify-between gap-2">
                          <View className="flex-row items-center gap-2">
                            <RNText className="text-[20px]">{c.flag}</RNText>
                            <RNText
                              numberOfLines={1}
                              className={cn("text-[18px] font-semibold", active ? "text-brand" : "text-primary")}
                            >
                              {c.label}
                            </RNText>
                          </View>
                          {/* <RNText>
                            <Muted className="text-[15px]">{`(${c.symbol} ${c.currency})`}</Muted>
                          </RNText> */}
                        </View>
                      </PressableOverlay>
                    )
                  })}
                </View>
              </View>
            </View>

            <View className="gap-6">
              <View className="items-center">
                <Muted className="text-center text-sm text-primary/80" style={{ writingDirection: "rtl" }}>
                  لا تشيل هم ، شحن سريع لباب البيت بدون اي قيمة اضافية 🚛
                </Muted>
              </View>

              {/* CTA */}
              <Button size="lg" onPress={handleContinue}>
                Continue
              </Button>
            </View>
          </SafeAreaView>
        </PageScrollView>
      </View>

      <Modal visible={showPushModal} animationType="fade" transparent onRequestClose={handleSkipPush}>
        <View className="flex-1 justify-end bg-black/30">
          <Pressable className="flex-1" onPress={handleSkipPush} accessibilityLabel="Dismiss push prompt" />

          <View className="gap-5 rounded-t-[28px] bg-white px-5 pb-6 pt-6">
            <View className="items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-full border border-[#cbd5f5] bg-[#e2e8f0]">
                <Bell color="#0f172a" size={24} strokeWidth={2.2} />
              </View>
              <RNText className="text-center font-geist-semibold text-[18px] text-[#0f172a]">
                Enable notifications to get order updates, delivery alerts, and exclusive pricing.
              </RNText>
              <RNText className="text-center text-[13px] leading-[18px] text-[#475569]">
                We will ask your device for permission on the next step.
              </RNText>
            </View>

            <View className="gap-3">
              <Button size="lg" fullWidth onPress={handleEnablePush}>
                Enable notifications
              </Button>
              <Button size="lg" variant="outline" fullWidth onPress={handleSkipPush}>
                Not now
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}
