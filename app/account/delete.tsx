import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { setDeletionRequestTimestamp } from "@/features/account/deletion"
import { AuthGate } from "@/features/auth/AuthGate"
import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Card } from "@/ui/surfaces/Card"
import { useRouter } from "expo-router"
import { AlertTriangle, Check } from "lucide-react-native"
import { useCallback, useMemo, useState } from "react"
import { Alert, Linking, ScrollView, Text, View } from "react-native"

const DELETION_RECIPIENTS = ["privacy@optionqaaf.com", "accounts@optionqaaf.com"]

const DEFAULT_TITLE = "Account Deletion Request"
const DEFAULT_BODY = `English: I request deletion of my OptionQaaf account and acknowledge that my personal data will be permanently removed.\n\nالعربية: أطلب حذف حسابي من OptionQaaf وأقر بأن بياناتي الشخصية ستُحذف نهائيًا.`

export default function AccountDeletionScreen() {
  const router = useRouter()

  return (
    <AuthGate requireAuth fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/delete" as const)} />}>
      <Screen bleedBottom>
        <MenuBar back />
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
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const mailtoUrl = useMemo(() => {
    const params = new URLSearchParams({
      subject: title.trim(),
      body: buildBody(body, profile?.email ?? null),
    })
    return `mailto:${DELETION_RECIPIENTS.join(",")}?${params.toString()}`
  }, [body, title, profile?.email])

  const requestDeletion = useCallback(async () => {
    const canOpen = await Linking.canOpenURL(mailtoUrl)
    if (!canOpen) {
      throw new Error("Unable to open the request composer.")
    }
    await Linking.openURL(mailtoUrl)
  }, [mailtoUrl])

  const finalizeDeletion = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await requestDeletion()
      setDeletionRequestTimestamp(new Date(), profile?.email ?? null)
      await logout()
      router.replace("/account" as const)
      show({ title: "Your account deletion request has been received.", type: "success" })
    } catch (err: any) {
      const message = err?.message || "Could not send the deletion request."
      show({ title: message, type: "danger" })
    } finally {
      setIsSubmitting(false)
    }
  }, [logout, requestDeletion, router, show])

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

        <Card padding="lg" className="bg-[#fff7ed] border border-[#fed7aa]">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 rounded-2xl bg-[#ffedd5] items-center justify-center">
              <AlertTriangle color="#9a3412" size={18} strokeWidth={2} />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-[#9a3412] font-geist-semibold text-[15px]">Please review before submitting.</Text>
              <Text className="text-[#9a3412] text-[13px] leading-[18px]">
                This request will be processed once submitted. Make sure the details below are accurate.
              </Text>
            </View>
          </View>
        </Card>

        <View className="gap-4">
          <Input label="Title" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
          <Input
            label="Body"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <PressableOverlay
            onPress={() => setConfirmed((prev) => !prev)}
            className="flex-row items-start gap-3 rounded-2xl bg-white p-4 border border-[#e2e8f0]"
          >
            <View
              className="h-6 w-6 rounded-md border items-center justify-center"
              style={{ borderColor: confirmed ? "#0f172a" : "#cbd5e1", backgroundColor: confirmed ? "#0f172a" : "#fff" }}
            >
              {confirmed ? <Check color="#f8fafc" size={14} strokeWidth={2.5} /> : null}
            </View>
            <Text className="flex-1 text-[#0f172a] text-[14px] leading-[20px]">
              I understand that my account and personal data will be deleted.
            </Text>
          </PressableOverlay>

          <Button size="lg" fullWidth onPress={handleSubmit} disabled={!confirmed || isSubmitting} isLoading={isSubmitting}>
            Delete Account
          </Button>
        </View>
      </View>
    </ScrollView>
  )
}

function buildBody(body: string, email: string | null) {
  const trimmed = body.trim()
  if (!email) return trimmed
  return `${trimmed}\n\nAccount email: ${email}`
}
