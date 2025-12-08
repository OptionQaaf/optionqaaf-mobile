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
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")
const ADMIN_SECRET = process.env.EXPO_PUBLIC_PUSH_ADMIN_SECRET
const DESTINATION_OPTIONS = [
  { key: "none", label: "No link" },
  { key: "product", label: "Product" },
  { key: "collection", label: "Collection" },
  { key: "custom", label: "App path" },
  { key: "url", label: "External link" },
] as const

export default function BroadcastScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/broadcast" as const)} />}
    >
      <Screen bleedBottom className="bg-[#f8fafc]">
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
  const router = useRouter()
  const scrollRef = useRef<ScrollView | null>(null)
  const insets = useSafeAreaInsets()
  const keyboardOffset = Platform.OS === "ios" ? insets.top + 60 : 0
  const bottomPadding = insets.bottom + 16

  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [destination, setDestination] = useState<(typeof DESTINATION_OPTIONS)[number]["key"]>("none")
  const [destinationValue, setDestinationValue] = useState("")
  const [isSending, setIsSending] = useState(false)

  const isAdmin = useMemo(() => isPushAdmin(profile?.email), [profile?.email])
  const trimmedTitle = title.trim()
  const trimmedMessage = message.trim()
  const missingConfig = !WORKER_URL || !ADMIN_SECRET

  const destinationMeta = useMemo(() => {
    const value = destinationValue.trim()
    if (destination === "none" || !value) return { path: null as string | null, url: null as string | null }
    if (destination === "product") return { path: `/products/${value.replace(/^\//, "")}`, url: null }
    if (destination === "collection") return { path: `/collections/${value.replace(/^\//, "")}`, url: null }
    if (destination === "custom") {
      const path = value.startsWith("/") ? value : `/${value}`
      return { path, url: null }
    }
    if (destination === "url") {
      const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`
      return { path: null, url: normalized }
    }
    return { path: null, url: null }
  }, [destination, destinationValue])

  const destinationSummary = useMemo(() => {
    if (destinationMeta.path) return `Opens ${destinationMeta.path}`
    if (destinationMeta.url) return `Opens ${destinationMeta.url}`
    return "Sends without a link"
  }, [destinationMeta.path, destinationMeta.url])

  const previewDestination = useCallback(() => {
    if (destinationMeta.url) {
      Linking.openURL(destinationMeta.url).catch(() => {})
      return
    }
    if (destinationMeta.path) {
      router.push(destinationMeta.path as any)
    }
  }, [destinationMeta.path, destinationMeta.url, router])

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
      const payload: Record<string, unknown> = {
        secret: ADMIN_SECRET,
        title: trimmedTitle || undefined,
        body: trimmedMessage,
      }

      if (destinationMeta.path) payload.path = destinationMeta.path
      if (destinationMeta.url) payload.url = destinationMeta.url

      const res = await fetch(`${WORKER_URL}/api/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Broadcast failed with status ${res.status}`)
      }

      show({ title: "Broadcast sent", type: "success" })
      setMessage("")
      setTitle("")
      setDestination("none")
      setDestinationValue("")
    } catch (err: any) {
      const message = err?.message || "Could not send broadcast"
      show({ title: message, type: "danger" })
    } finally {
      setIsSending(false)
    }
  }, [missingConfig, trimmedMessage, trimmedTitle, destinationMeta, show])

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
    <KeyboardAvoidingView
      className="flex-1 bg-[#f8fafc]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardOffset}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: bottomPadding, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={{ backgroundColor: "#f8fafc" }}
      >
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

            <View className="gap-2">
              <Text className="text-[#0f172a] font-geist-semibold text-[14px]">Tap destination</Text>
              <View className="flex-row flex-wrap gap-2">
                {DESTINATION_OPTIONS.map((opt) => {
                  const active = destination === opt.key
                  return (
                    <Button
                      key={opt.key}
                      size="sm"
                      variant={active ? "solid" : "outline"}
                      className="px-3"
                      onPress={() => setDestination(opt.key)}
                    >
                      {opt.label}
                    </Button>
                  )
                })}
              </View>
              {destination !== "none" ? (
                <Input
                  label={
                    destination === "product"
                      ? "Product handle"
                      : destination === "collection"
                        ? "Collection handle"
                        : destination === "url"
                          ? "URL"
                          : "App path"
                  }
                  placeholder={
                    destination === "product"
                      ? "e.g. cool-tee"
                      : destination === "collection"
                        ? "e.g. summer-2024"
                        : destination === "url"
                          ? "https://example.com/promo"
                          : "/collections/summer"
                  }
                  value={destinationValue}
                  onChangeText={setDestinationValue}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => {
                    // Ensure the last input scrolls above the keyboard
                    scrollRef.current?.scrollToEnd({ animated: true })
                  }}
                />
              ) : null}
              <View className="flex-row items-center justify-between">
                <Text className="text-[#475569] text-[12px]">{destinationSummary}</Text>
                {(destinationMeta.path || destinationMeta.url) && (
                  <Button variant="ghost" size="sm" onPress={previewDestination}>
                    Preview
                  </Button>
                )}
              </View>
            </View>

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
    </KeyboardAvoidingView>
  )
}
