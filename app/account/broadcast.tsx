import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { useCustomerProfile } from "@/features/account/api"
import { AuthGate } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { isPushAdmin } from "@/features/notifications/admin"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Card } from "@/ui/surfaces/Card"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, ScrollView, Text, View } from "react-native"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")
const ADMIN_SECRET = process.env.EXPO_PUBLIC_PUSH_ADMIN_SECRET

export default function BroadcastScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/broadcast" as const)} />}
    >
      <Screen bleedBottom>
        <MenuBar back />
        <BroadcastContent />
      </Screen>
    </AuthGate>
  )
}

function BroadcastContent() {
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile, isLoading, error } = useCustomerProfile({ enabled: isAuthenticated })
  const { show } = useToast()

  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  const isAdmin = useMemo(() => isPushAdmin(profile?.email), [profile?.email])
  const trimmedTitle = title.trim()
  const trimmedMessage = message.trim()
  const missingConfig = !WORKER_URL || !ADMIN_SECRET

  const handleSend = useCallback(async () => {
    if (!trimmedMessage) {
      show({ title: "Message is required", type: "info" })
      return
    }

    if (missingConfig) {
      show({ title: "Push worker env vars missing", type: "danger" })
      return
    }

    setIsSending(true)
    try {
      const res = await fetch(`${WORKER_URL}/api/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: ADMIN_SECRET,
          title: trimmedTitle || undefined,
          body: trimmedMessage,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Broadcast failed with status ${res.status}`)
      }

      show({ title: "Broadcast sent", type: "success" })
      setMessage("")
      setTitle("")
    } catch (err: any) {
      const message = err?.message || "Could not send broadcast"
      show({ title: message, type: "danger" })
    } finally {
      setIsSending(false)
    }
  }, [missingConfig, trimmedMessage, trimmedTitle, show])

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Could not load profile"
      show({ title: message, type: "danger" })
    }
  }, [error, show])

  if (isLoading && !profile) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#111827" />
      </View>
    )
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 bg-[#f8fafc] px-5 pt-8">
        <Card padding="lg" className="gap-3">
          <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Admin access required</Text>
          <Text className="text-[#475569] text-[13px] leading-[19px]">
            This tool is limited to approved admin accounts. Switch accounts or contact the team if you should have
            access.
          </Text>
        </Card>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-[#f8fafc]" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-5 pt-6 gap-6">
        <View className="gap-2">
          <Text className="text-[#0f172a] font-geist-semibold text-[20px]">Broadcast notification</Text>
          <Text className="text-[#475569] text-[14px] leading-[20px]">
            Send a one-off push to every registered device. Use sparingly and keep messages concise.
          </Text>
        </View>

        <Card padding="lg" className="gap-4">
          <Input
            label="Title"
            placeholder="Optional headline"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
          />
          <Input
            label="Message"
            placeholder="What should everyone know?"
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
          />

          {missingConfig ? (
            <Text className="text-danger text-[13px]">
              Set EXPO_PUBLIC_PUSH_WORKER_URL and EXPO_PUBLIC_PUSH_ADMIN_SECRET to send broadcasts.
            </Text>
          ) : null}

          <Button
            fullWidth
            onPress={handleSend}
            isLoading={isSending}
            disabled={isSending || !trimmedMessage || missingConfig}
          >
            Send broadcast
          </Button>
        </Card>
      </View>
    </ScrollView>
  )
}
