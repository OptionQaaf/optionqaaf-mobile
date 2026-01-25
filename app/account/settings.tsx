import { useCustomerProfile } from "@/features/account/api"
import { isDeletionRequestPending } from "@/features/account/deletion"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { isPushAdmin } from "@/features/notifications/admin"
import { useAppMetadata, type AppMetadata } from "@/lib/diagnostics/appMetadata"
import { useNetworkStatus, type NetworkStatus } from "@/lib/network/useNetworkStatus"
import { fastForwardAccessTokenExpiry } from "@/lib/shopify/customer/auth"
import { clearOnboardingFlag } from "@/lib/storage/flags"
import { kv } from "@/lib/storage/mmkv"
import { useNotificationSettings, type NotificationPermissionState } from "@/store/notifications"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Card } from "@/ui/surfaces/Card"
import * as Notifications from "expo-notifications"
import { useRouter, type RelativePathString } from "expo-router"
import * as Updates from "expo-updates"
import { Clock, Megaphone, RefreshCcw, Settings2, Sparkles, Trash2 } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Modal, Pressable, ScrollView, Text, View } from "react-native"

export default function AccountSettingsScreen() {
  const router = useRouter()

  return (
    <AuthGate requireAuth fallback={<AccountSignInFallback onSuccess={() => router.replace("/account" as const)} />}>
      <Screen bleedBottom>
        <MenuBar back />
        <AccountSettingsContent />
      </Screen>
    </AuthGate>
  )
}

function AccountSettingsContent() {
  const router = useRouter()
  const { show } = useToast()
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated })
  const metadata = useAppMetadata()
  const networkStatus = useNetworkStatus()
  const expoPushToken = useNotificationSettings((state) => state.expoPushToken)
  const permissionsStatus = useNotificationSettings((state) => state.permissionsStatus)
  const lastRegistrationAttempt = useNotificationSettings((state) => state.lastRegistrationAttempt)
  const [deletionPending, setDeletionPending] = useState(false)
  const [deletionPendingLoaded, setDeletionPendingLoaded] = useState(false)
  const deletionCacheRef = useRef(new Map<string, boolean>())
  const [diagnosticsUnlocked, setDiagnosticsUnlocked] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  const isAdmin = useMemo(() => isPushAdmin(profile?.email), [profile?.email])

  useEffect(() => {
    if (!isAdmin) {
      setDiagnosticsUnlocked(false)
      setShowDiagnostics(false)
    }
  }, [isAdmin])

  const handleVersionLongPress = useCallback(() => {
    if (!isAdmin) return
    setDiagnosticsUnlocked(true)
    show({ title: "Diagnostics unlocked", type: "info" })
  }, [isAdmin, show])

  const handleOpenDiagnostics = useCallback(() => {
    if (!isAdmin || !diagnosticsUnlocked) return
    setShowDiagnostics(true)
  }, [isAdmin, diagnosticsUnlocked])

  const handleCloseDiagnostics = useCallback(() => setShowDiagnostics(false), [])

  const settingsLinks = useMemo(
    () => [
      {
        title: "Notifications",
        body: "Control messages, offers, and alerts.",
        Icon: Settings2,
        path: "/account/notifications" as RelativePathString,
      },
    ],
    [],
  )

  const adminLinks = useMemo(() => {
    if (!isAdmin) return []
    return [
      {
        title: "Popup manager",
        body: "Publish popup announcements for the app.",
        Icon: Sparkles,
        path: "/account/popup" as RelativePathString,
      },
      {
        title: "Push broadcast",
        body: "Send a push notification to all devices.",
        Icon: Megaphone,
        path: "/account/broadcast" as RelativePathString,
      },
    ]
  }, [isAdmin])

  useEffect(() => {
    let isActive = true
    const email = profile?.email?.trim().toLowerCase()
    setDeletionPendingLoaded(false)
    if (!email) {
      setDeletionPending(false)
      setDeletionPendingLoaded(true)
      return () => {
        isActive = false
      }
    }

    const cached = deletionCacheRef.current.get(email)
    if (cached !== undefined) {
      setDeletionPending(cached)
    } else {
      setDeletionPending(false)
    }

    const run = async () => {
      const pending = await isDeletionRequestPending(new Date(), email)
      deletionCacheRef.current.set(email, pending)
      if (isActive) {
        setDeletionPending(pending)
        setDeletionPendingLoaded(true)
      }
    }
    void run()
    return () => {
      isActive = false
    }
  }, [profile?.email])

  const handleDebugExpireToken = useCallback(async () => {
    try {
      await fastForwardAccessTokenExpiry(3600)
      show({ title: "Fast-forwarded token expiry by 1 hour", type: "success" })
    } catch (err: any) {
      const message = err?.message || "Unable to fast-forward token"
      show({ title: message, type: "danger" })
    }
  }, [show])

  const handleResetOnboarding = useCallback(async () => {
    try {
      kv.del("notification-settings")
      kv.del("prefs")
      await clearOnboardingFlag()
      show({ title: "Cache cleared. Restarting onboarding…", type: "success" })
      router.replace("/(onboarding)/locale" as const)
    } catch (err: any) {
      const message = err?.message || "Unable to reset onboarding cache"
      show({ title: message, type: "danger" })
    }
  }, [router, show])

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className="bg-[#f8fafc]">
        <View className="px-5 pt-6 pb-4 gap-7">
          <View className="gap-2">
            <Text className="text-[#0f172a] font-geist-semibold text-[20px]">Account settings</Text>
            <Text className="text-[#475569] text-[14px] leading-[20px]">
              Manage notifications, admin tools, and account controls.
            </Text>
          </View>

          {!deletionPendingLoaded ? null : deletionPending ? (
            <Card padding="lg" className="border border-[#fecaca] bg-[#fef2f2] gap-2">
              <Text className="text-[#991b1b] font-geist-semibold text-[15px]">
                This account is going through deletion.
              </Text>
              <Text className="text-[#b91c1c] text-[13px] leading-[18px]">
                Your account and all data will be permanently deleted soon. Any changes or activity will be lost.
              </Text>
            </Card>
          ) : null}

          <Section title="Notifications">
            <View className="gap-3">
              {settingsLinks.map((link) => (
                <AccountLink
                  key={link.title}
                  title={link.title}
                  description={link.body}
                  icon={<link.Icon color="#1f2937" size={20} strokeWidth={2} />}
                  onPress={() => router.push(link.path)}
                />
              ))}
            </View>
          </Section>

          {adminLinks.length > 0 ? (
            <Section title="Admin tools">
              <View className="gap-3">
                {adminLinks.map((link) => (
                  <AccountLink
                    key={link.title}
                    title={link.title}
                    description={link.body}
                    icon={<link.Icon color="#1f2937" size={20} strokeWidth={2} />}
                    onPress={() => router.push(link.path)}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          {__DEV__ ? (
            <Section title="Developer">
              <View className="gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  onPress={handleResetOnboarding}
                  leftIcon={<RefreshCcw color="#111827" size={18} strokeWidth={2} />}
                >
                  Reset onboarding/cache (dev)
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  onPress={handleDebugExpireToken}
                  leftIcon={<Clock color="#111827" size={18} strokeWidth={2} />}
                >
                  Expire token (debug)
                </Button>
              </View>
            </Section>
          ) : null}

          <Section title="App info">
            <Card padding="lg" className="gap-3">
              <View className="gap-1">
                <Pressable
                  onLongPress={handleVersionLongPress}
                  delayLongPress={450}
                  className="flex-row items-center justify-between"
                >
                  <Text className="text-[#475569] text-[13px]">App version</Text>
                  <Text className="text-[#0f172a] font-geist-semibold text-[15px]">
                    {metadata.version ?? "Unknown"}
                  </Text>
                </Pressable>
              </View>
              {isAdmin && diagnosticsUnlocked ? (
                <View className="pt-2">
                  <Button variant="ghost" size="md" fullWidth onPress={handleOpenDiagnostics}>
                    View diagnostics
                  </Button>
                </View>
              ) : null}
            </Card>
          </Section>

          <Section title="Account">
            <View className="gap-2">
              {!deletionPending ? (
                <Button
                  variant="danger"
                  size="lg"
                  fullWidth
                  onPress={() => router.push("/account/delete" as const)}
                  leftIcon={<Trash2 color="#DC2626" size={18} strokeWidth={2} />}
                >
                  Delete Account
                </Button>
              ) : (
                <Text className="text-[#475569] text-[13px]">Deletion is already in progress.</Text>
              )}
            </View>
          </Section>
        </View>
      </ScrollView>
      <DiagnosticsModal
        visible={showDiagnostics}
        onClose={handleCloseDiagnostics}
        metadata={metadata}
        networkStatus={networkStatus}
        expoPushToken={expoPushToken}
        permissionsStatus={permissionsStatus}
        profileEmail={profile?.email ?? null}
        lastRegistrationAttempt={lastRegistrationAttempt}
      />
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-[#0f172a] font-geist-semibold text-[16px]">{title}</Text>
      {children}
    </View>
  )
}

function AccountLink({
  title,
  description,
  icon,
  onPress,
}: {
  title: string
  description: string
  icon: ReactNode
  onPress: () => void
}) {
  return (
    <PressableOverlay onPress={onPress} className="rounded-sm">
      <Card padding="lg" className="flex-row items-center gap-4">
        <View className="h-12 w-12 rounded-sm bg-[#f1f5f9] items-center justify-center">{icon}</View>
        <View className="flex-1 gap-1">
          <Text className="text-[#0f172a] font-geist-semibold text-[15px]">{title}</Text>
          <Text className="text-[#475569] text-[13px] leading-[18px]">{description}</Text>
        </View>
      </Card>
    </PressableOverlay>
  )
}

type DiagnosticsModalProps = {
  visible: boolean
  onClose: () => void
  metadata: AppMetadata
  networkStatus: NetworkStatus
  expoPushToken: string | null
  permissionsStatus: NotificationPermissionState | null
  profileEmail: string | null
  lastRegistrationAttempt: string | null
}

function DiagnosticsModal({
  visible,
  onClose,
  metadata,
  networkStatus,
  expoPushToken,
  permissionsStatus,
  profileEmail,
  lastRegistrationAttempt,
}: DiagnosticsModalProps) {
  const [livePermission, setLivePermission] = useState<NotificationPermissionState | null>(permissionsStatus ?? null)

  useEffect(() => {
    if (!visible) {
      setLivePermission(permissionsStatus ?? null)
      return
    }

    let mounted = true

    const applyStatus = (status: NotificationPermissionState) => {
      if (!mounted) return
      setLivePermission((prev) => {
        if (
          prev &&
          prev.status === status.status &&
          prev.granted === status.granted &&
          prev.canAskAgain === status.canAskAgain
        ) {
          return prev
        }
        return status
      })
    }

    Notifications.getPermissionsAsync()
      .then((status) => {
        applyStatus({
          status: status.status,
          granted: status.granted,
          canAskAgain: status.canAskAgain,
        })
      })
      .catch(() => {
        applyStatus(permissionsStatus ?? { status: "unknown", granted: false, canAskAgain: false })
      })

    return () => {
      mounted = false
    }
  }, [visible, permissionsStatus])

  const permissionState = livePermission ?? permissionsStatus
  const permissionLabel = permissionState?.status ?? "unknown"

  const appRows = [
    { label: "App version", value: metadata.version ?? "unknown" },
    { label: "Build number", value: metadata.buildNumber ?? "unknown" },
    { label: "Native application ID", value: metadata.applicationId ?? "unknown" },
  ]

  const otaRows = [
    { label: "Runtime version", value: Updates.runtimeVersion ?? "unknown" },
    { label: "OTA channel", value: Updates.channel ?? "unknown" },
    {
      label: "Last update time",
      value: Updates.createdAt ? Updates.createdAt.toLocaleString() : "unknown",
    },
    { label: "Update ID", value: Updates.updateId ?? "unknown" },
  ]

  const networkRows = [
    { label: "Connected", value: formatBoolean(networkStatus.isConnected) },
    { label: "Internet reachable", value: formatBoolean(networkStatus.isInternetReachable) },
    { label: "Connection type", value: networkStatus.type ?? "unknown" },
  ]

  const pushRows = [
    { label: "Permission status", value: permissionLabel },
    { label: "Push token present", value: expoPushToken ? "Yes" : "No" },
    { label: "Associated email", value: maskEmail(profileEmail) },
    { label: "Last registration attempt", value: formatTimestamp(lastRegistrationAttempt) },
  ]

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 bg-black/20 justify-end">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl px-5 py-4" style={{ maxHeight: "85%" }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[#0f172a] font-geist-semibold text-[18px]">Diagnostics</Text>
            <Button variant="ghost" size="sm" onPress={onClose}>
              Close
            </Button>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} className="gap-4">
            <DiagnosticSection title="App" rows={appRows} />
            <DiagnosticSection title="OTA" rows={otaRows} />
            <DiagnosticSection title="Network" rows={networkRows} />
            <DiagnosticSection title="Push" rows={pushRows} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

type DiagnosticRowProps = { label: string; value: string }

function DiagnosticSection({ title, rows }: { title: string; rows: DiagnosticRowProps[] }) {
  return (
    <View className="gap-2">
      <Text className="text-[#0f172a] font-geist-semibold text-[15px]">{title}</Text>
      <View className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-3 gap-1">
        {rows.map((row) => (
          <DiagnosticRow key={row.label} {...row} />
        ))}
      </View>
    </View>
  )
}

function DiagnosticRow({ label, value }: DiagnosticRowProps) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[#475569] text-[12px]">{label}</Text>
      <Text className="text-[#0f172a] font-geist-semibold text-[12px]">{value}</Text>
    </View>
  )
}

function maskEmail(value: string | null) {
  if (!value) return "Not signed in"
  const [local, domain] = value.split("@")
  if (!domain) return value
  const safeLocal =
    local.length <= 2 ? local : `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local.slice(-1)}`
  return `${safeLocal}@${domain}`
}

function formatBoolean(value: boolean | null) {
  if (value === null) return "unknown"
  return value ? "Yes" : "No"
}

function formatTimestamp(value: string | null) {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Never"
  return date.toLocaleString()
}
