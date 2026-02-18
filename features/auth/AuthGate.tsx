import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { useToast } from "@/ui/feedback/Toast"
import { Button } from "@/ui/primitives/Button"
import { Card } from "@/ui/surfaces/Card"
import { Image } from "expo-image"
import { Lock, MapPin, Receipt, UserRound } from "lucide-react-native"
import React, { useCallback, useState } from "react"
import { Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

const PERKS = [
  { title: "Order history", body: "Review purchases and find receipts fast.", Icon: Receipt },
  { title: "Account details", body: "Keep your info and preferences synced.", Icon: UserRound },
  { title: "Saved addresses", body: "Checkout quicker by reusing shipping info.", Icon: MapPin },
] as const

type AuthGateProps = {
  children: React.ReactNode
  requireAuth?: boolean
  fallback?: React.ReactNode
}

export function AuthGate({ children, requireAuth = false, fallback }: AuthGateProps) {
  const { initializing, isAuthenticated } = useShopifyAuth()

  if (!requireAuth) {
    return <>{children}</>
  }

  if (initializing) return null
  if (!isAuthenticated) {
    return <>{fallback ?? <SignInPrompt />}</>
  }

  return <>{children}</>
}

type SignInPromptProps = {
  title?: string
  description?: string
  buttonLabel?: string
  onSuccess?: () => void
  bleedTopImage?: boolean
  showBackgroundImage?: boolean
}

export function SignInPrompt({
  title = "Sign in to continue",
  description = "Customer-only features need a quick login with your OptionQaaf account.",
  buttonLabel = "Sign in",
  onSuccess,
  bleedTopImage = false,
  showBackgroundImage = true,
}: SignInPromptProps) {
  const { login } = useShopifyAuth()
  const { show } = useToast()
  const [pending, setPending] = useState(false)

  const handlePress = useCallback(async () => {
    if (pending) return
    setPending(true)
    try {
      await login()
      onSuccess?.()
    } catch (err: any) {
      const message = err?.message || "Something went wrong during sign in"
      show({ title: message, type: "danger" })
    } finally {
      setPending(false)
    }
  }, [login, onSuccess, pending, show])

  const edges: ("top" | "bottom" | "left" | "right")[] = bleedTopImage ? ["bottom"] : ["top", "bottom"]

  return (
    <SafeAreaView edges={edges} style={{ flex: 1 }} className={bleedTopImage ? "bg-transparent" : "bg-[#f8fafc]"}>
      {showBackgroundImage ? (
        <Image
          source={require("@/assets/images/hero-blur.png")}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 180,
            opacity: 0.25,
          }}
          contentFit="cover"
        />
      ) : null}

      <View className="flex-grow">
        <View className="flex-1 justify-between gap-8 px-5 pt-16 pb-14">
          <View className="gap-6">
            <Card padding="lg" className="gap-4">
              <View className="flex-row items-center gap-3">
                <View className="h-12 w-12 rounded-full bg-[#0b101a] items-center justify-center">
                  <UserRound color="#f8fafc" size={22} strokeWidth={2} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-[#0f172a] font-geist-semibold text-[18px]">{title}</Text>
                  <Text className="text-[#475569] text-[14px] leading-[20px]">{description}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2 rounded-2xl bg-[#f1f5f9] px-4 py-3">
                <Lock color="#1f2937" size={16} strokeWidth={2} />
                <Text className="text-[#1f2937] text-[13px]">You’re browsing as a guest</Text>
              </View>
            </Card>

            <Card padding="lg" className="gap-3">
              <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Why sign in</Text>
              <View className="gap-3">
                {PERKS.map((perk) => (
                  <View key={perk.title} className="flex-row items-start gap-3">
                    <View className="h-10 w-10 rounded-2xl bg-[#e2e8f0] items-center justify-center">
                      <perk.Icon color="#1f2937" size={18} strokeWidth={2} />
                    </View>
                    <View className="flex-1 gap-[2px]">
                      <Text className="text-[#0f172a] font-geist-medium text-[14px]">{perk.title}</Text>
                      <Text className="text-[#475569] text-[12px] leading-[18px]">{perk.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>

          <View className="gap-2 pb-6">
            <Text className="text-center text-[#64748b] text-[10px] leading-[18px] px-4">
              We handle the secure part. You will be redirected back here.
            </Text>
            <Button
              size="lg"
              fullWidth
              isLoading={pending}
              onPress={handlePress}
              leftIcon={<Lock color="#f8fafc" size={18} strokeWidth={2} />}
            >
              {buttonLabel}
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
