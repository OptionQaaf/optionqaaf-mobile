import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { useCustomerProfile } from "@/features/account/api"
import { AuthGate } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { isPushAdmin } from "@/features/notifications/admin"
import { kv } from "@/lib/storage/mmkv"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Card } from "@/ui/surfaces/Card"
import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
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
type BroadcastHistoryEntry = {
  id: string
  title: string | null
  body: string
  destination: string
  createdAt: string
}
const HISTORY_KEY = "broadcast-history"
const MAX_HISTORY = 20

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
  const router = useRouter()
  const scrollRef = useRef<ScrollView | null>(null)
  const insets = useSafeAreaInsets()
  const keyboardOffset = Platform.OS === "ios" ? insets.top : 0
  const bottomPadding = insets.bottom + 24

  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [destination, setDestination] = useState<(typeof DESTINATION_OPTIONS)[number]["key"]>("none")
  const [destinationValue, setDestinationValue] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [history, setHistory] = useState<BroadcastHistoryEntry[]>([])

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
      if (imageUrl.trim()) payload.image = imageUrl.trim()

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

      const entry: BroadcastHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: trimmedTitle || null,
        body: trimmedMessage,
        destination: destinationSummary,
        createdAt: new Date().toISOString(),
      }
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_HISTORY)
        kv.set(HISTORY_KEY, JSON.stringify(next))
        return next
      })
    } catch (err: any) {
      const message = err?.message || "Could not send broadcast"
      show({ title: message, type: "danger" })
    } finally {
      setIsSending(false)
    }
  }, [missingConfig, trimmedMessage, trimmedTitle, destinationMeta, show])

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      show({ title: "Media permission needed to pick an image", type: "info" })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: false,
    })
    if (result.canceled || !result.assets?.length) return

    const upload = await fetch(`${WORKER_URL}/api/upload-image`, {
      method: "POST",
      headers: {
        "Content-Type": result.assets[0].mimeType ?? "application/octet-stream",
      },
      body: await fetch(result.assets[0].uri).then((res) => res.blob()),
    })

    const json = await upload.json()
    setImageUrl(json.url)
  }, [show])

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Could not load profile"
      show({ title: message, type: "danger" })
    }
  }, [error, show])

  useEffect(() => {
    try {
      const raw = kv.get(HISTORY_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as BroadcastHistoryEntry[]
      if (Array.isArray(parsed)) setHistory(parsed)
    } catch {
      // ignore parse errors
    }
  }, [])

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
      className="flex-1"
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
            <Input
              label="Image (optional - only works on android for now.)"
              placeholder="https://example.com/promo.jpg"
              value={imageUrl}
              onChangeText={setImageUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button variant="outline" size="sm" onPress={pickImage}>
              Pick from gallery
            </Button>
            {imageUrl.trim() ? (
              <View className="rounded-xl overflow-hidden border border-[#e2e8f0]">
                <Image source={{ uri: imageUrl.trim() }} style={{ width: "100%", height: 180 }} contentFit="cover" />
              </View>
            ) : null}

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
          <Card padding="lg" className="gap-3">
            <Text className="text-[#0f172a] font-geist-semibold text-[16px]">History</Text>
            {history.length === 0 ? (
              <Text className="text-[#475569] text-[13px]">No broadcasts yet</Text>
            ) : (
              history.map((item) => (
                <View key={item.id} className="border border-[#e2e8f0] rounded-xl p-3 bg-white gap-1">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[#0f172a] font-geist-medium text-[14px]" numberOfLines={1}>
                      {item.title || "Untitled"}
                    </Text>
                    <Text className="text-[#94a3b8] text-[12px]">{formatHistoryDate(item.createdAt)}</Text>
                  </View>
                  <Text className="text-[#0f172a] text-[13px]">{item.body}</Text>
                  <Text className="text-[#475569] text-[12px]">Destination: {item.destination}</Text>
                </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function formatHistoryDate(iso: string) {
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return iso
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d)
  } catch {
    return iso
  }
}
