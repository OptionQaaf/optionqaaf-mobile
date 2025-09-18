import { markOnboardingDone } from "@/lib/storage/flags"
import { usePrefs, type LanguageCode } from "@/store/prefs"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { Screen } from "@/ui/layout/Screen"
import { Button } from "@/ui/primitives/Button"
import { H3, Muted } from "@/ui/primitives/Typography"
import { cn } from "@/ui/utils/cva"
import { router } from "expo-router"
import { useMemo, useState } from "react"
import { Image, Text as RNText, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { CountryCode } from "@/features/locale/countries"
import type { CurrencyCode } from "@/features/currency/config"
import { COUNTRIES } from "@/features/locale/countries"

export default function LocaleOnboarding() {
  const { setPrefs } = usePrefs()
  const [language, setLanguage] = useState<LanguageCode>("EN")
  const [country, setCountry] = useState<CountryCode>("SA")
  const [currency, setCurrency] = useState<CurrencyCode>("SAR")

  const languages = useMemo(
    () => [
      { id: "EN", label: "English" },
      { id: "AR", label: "العربية" },
    ],
    [],
  )

  const applyCountry = (c: CountryCode) => {
    setCountry(c)
    const match = COUNTRIES.find((x) => x.id === c)
    if (match) setCurrency(match.currency) // auto-set currency
  }

  const continueHandler = async () => {
    setPrefs({ language, country, currency })
    await markOnboardingDone()
    router.replace("/home")
  }

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
        <PageScrollView>
          <SafeAreaView className="flex-1 justify-between px-4 pt-8" edges={["bottom"]}>
            {/* FORM GROUP */}
            <View className="flex-col gap-4">
              {/* Language */}
              {/* <View className="flex-col gap-2">
                <View>
                  <H3>Language</H3>
                  <Muted className="text-md">Select your language</Muted>
                </View>
                <View className="flex-row w-full gap-3">
                  {languages.map((l) => {
                    const active = language === (l.id as LanguageCode)
                    return (
                      <PressableOverlay
                        haptic="light"
                        key={l.id}
                        onPress={() => setLanguage(l.id as LanguageCode)}
                        className={cn(
                          "items-center justify-center rounded-2xl border py-3",
                          active ? "border-brand bg-brand/10" : "border-[#E6E6E6] bg-white",
                        )}
                        pressableClassName="flex-1"
                      >
                        <RNText className={cn("text-xl font-bold", active ? "text-brand" : "text-primary")}>
                          {l.label}
                        </RNText>
                      </PressableOverlay>
                    )
                  })}
                </View>
              </View> */}

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
                  🚀 توصيل سريع إلى باب منزلك وأسعار شاملة.
                </Muted>
                <Muted className="text-center text-sm text-primary/80">
                  🚚 Fast delivery to your doorstep. All-inclusive prices.
                </Muted>
              </View>

              {/* CTA */}
              <Button size="lg" onPress={continueHandler}>
                Continue
              </Button>
            </View>
          </SafeAreaView>
        </PageScrollView>
      </View>
    </Screen>
  )
}
