import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { useCustomerProfile } from "@/features/account/api"
import { setDeletionRequestTimestamp } from "@/features/account/deletion"
import { AuthGate } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { Button } from "@/ui/primitives/Button"
import { Card } from "@/ui/surfaces/Card"
import { useRouter } from "expo-router"
import { AlertTriangle, Check } from "lucide-react-native"
import { useCallback, useState } from "react"
import { Alert, ScrollView, Text, View } from "react-native"

const DEFAULT_TITLE = "Account Deletion Request"
const DEFAULT_BODY = `English: I request deletion of my OptionQaaf account and acknowledge that my personal data will be permanently removed.\n\nالعربية: أطلب حذف حسابي من OptionQaaf وأقر بأن بياناتي الشخصية ستُحذف نهائيًا.`
const ACCOUNT_API_BASE = process.env.EXPO_PUBLIC_ACCOUNT_API_BASE || "https://api.optionqaaf.com"

export default function AccountDeletionScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/delete" as const)} />}
    >
      <Screen bleedBottom>
        <AccountDeletionContent />
      </Screen>
    </AuthGate>
  )
}

function AccountDeletionContent() {
  const { logout, isAuthenticated } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated })
  const { show } = useToast()
  const router = useRouter()
  const title = DEFAULT_TITLE
  const body = DEFAULT_BODY
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requestDeletion = useCallback(async () => {
    const email = profile?.email
    if (!email) {
      throw new Error("Email is required to submit a deletion request.")
    }
    const response = await fetch(`${ACCOUNT_API_BASE}/account/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        body,
        email,
      }),
    })

    if (response.status !== 202) {
      let message = "Unable to submit the deletion request."
      try {
        const data = await response.json()
        if (data?.error) message = data.error
      } catch {}
      throw new Error(message)
    }
  }, [body, profile?.email, title])

  const finalizeDeletion = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await requestDeletion()
      await setDeletionRequestTimestamp(new Date(), profile?.email ?? null)
      await logout()
      router.replace("/account" as const)
      show({ title: "Your account is going through deletion.", type: "success" })
    } catch (err: any) {
      const message = err?.message || "Could not send the deletion request."
      show({ title: message, type: "danger" })
    } finally {
      setIsSubmitting(false)
    }
  }, [logout, profile?.email, requestDeletion, router, show])

  const handleSubmit = useCallback(() => {
    Alert.alert(
      "Confirm Account Deletion",
      "Are you sure you want to request deletion of your account?\nYour account will be sent out for deletion and you will be logged out.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", style: "destructive", onPress: () => void finalizeDeletion() },
      ],
    )
  }, [finalizeDeletion])

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1 bg-[#f8fafc]">
      <View className="px-5 pt-6 gap-6">
        <View className="gap-2">
          <Text className="text-[#0f172a] font-geist-semibold text-[22px]">Delete Account</Text>
          <Text className="text-[#475569] text-[14px] leading-[20px]">
            Deleting your account will permanently remove your personal data. This action cannot be undone.
          </Text>
        </View>

        <View className="gap-5">
          <Card padding="lg" className="bg-[#fff7ed] border border-[#fed7aa]">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 rounded-2xl bg-[#ffedd5] items-center justify-center">
                <AlertTriangle color="#9a3412" size={18} strokeWidth={2} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-[#9a3412] font-geist-semibold text-[15px]">Please read before proceeding.</Text>
                <Text className="text-[#9a3412] text-[13px] leading-[18px]">
                  This action is permanent and cannot be undone once submitted.
                </Text>
              </View>
            </View>
          </Card>

          <Card padding="lg" className="bg-white border border-[#e2e8f0]">
            <Text className="text-[#0f172a] font-geist-semibold text-[16px] mb-3">Consequences</Text>
            <View className="gap-3">
              <Text className="text-[#475569] text-[14px] leading-[20px]">
                • Your account and personal data will be permanently deleted.
              </Text>
              <Text className="text-[#475569] text-[14px] leading-[20px]">
                • You will be logged out immediately after submitting this request.
              </Text>
              <Text className="text-[#475569] text-[14px] leading-[20px]">
                • Any order history and saved addresses will no longer be accessible.
              </Text>
            </View>
          </Card>

          <Card padding="lg" className="bg-white border border-[#e2e8f0]">
            <Text className="text-[#0f172a] font-geist-semibold text-[16px] mb-3 text-right">النتائج</Text>
            <View className="gap-3">
              <Text className="text-[#475569] text-[14px] leading-[20px] text-right">
                • سيتم حذف حسابك وبياناتك الشخصية نهائيًا.
              </Text>
              <Text className="text-[#475569] text-[14px] leading-[20px] text-right">
                • سيتم تسجيل خروجك مباشرة بعد إرسال هذا الطلب.
              </Text>
              <Text className="text-[#475569] text-[14px] leading-[20px] text-right">
                • لن تتمكن من الوصول إلى سجل الطلبات أو العناوين المحفوظة.
              </Text>
            </View>
          </Card>

          <PressableOverlay
            onPress={() => setConfirmed((prev) => !prev)}
            className="flex-row items-start gap-3 rounded-2xl bg-white p-4 border border-[#e2e8f0]"
          >
            <View
              className="h-6 w-6 rounded-md border items-center justify-center"
              style={{
                borderColor: confirmed ? "#0f172a" : "#cbd5e1",
                backgroundColor: confirmed ? "#0f172a" : "#fff",
              }}
            >
              {confirmed ? <Check color="#f8fafc" size={14} strokeWidth={2.5} /> : null}
            </View>
            <Text className="flex-1 text-[#0f172a] text-[14px] leading-[20px]">
              I have read the consequences above and agree to proceed.
            </Text>
          </PressableOverlay>

          <Button
            size="lg"
            fullWidth
            onPress={handleSubmit}
            disabled={!confirmed || isSubmitting}
            isLoading={isSubmitting}
          >
            Delete Account
          </Button>
        </View>
      </View>
    </ScrollView>
  )
}
