import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { requestPushPermissionsAndToken } from "@/features/notifications/permissions"
import { useNotificationSettings } from "@/store/notifications"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Card } from "@/ui/surfaces/Card"
import { Button } from "@/ui/primitives/Button"
import * as Notifications from "expo-notifications"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState, Linking, Platform, ScrollView, Switch, Text, View } from "react-native"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")

export default function NotificationsScreen() {
  const router = useRouter()

  return (
    <AuthGate requireAuth fallback={<AccountSignInFallback onSuccess={() => router.replace("/account" as const)} />}>
      <Screen bleedBottom>
        <MenuBar back />
        <NotificationsContent />
      </Screen>
    </AuthGate>
  )
}

type PermissionsStatus = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>

function NotificationsContent() {
  const { pushEnabled, emailEnabled, setPreferences, setPushPreference, expoPushToken } = useNotificationSettings()
  const { show } = useToast()
  const [permissions, setPermissions] = useState<PermissionsStatus | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const autoEnabledRef = useRef(false)

  const refreshPermissions = useCallback(async () => {
    try {
      const status = await Notifications.getPermissionsAsync()
      setPermissions(status)
    } catch {
      setPermissions(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    refreshPermissions()
    const sub = AppState.addEventListener("change", (state) => {
      if (!mounted) return
      if (state === "active") refreshPermissions()
    })
    return () => {
      mounted = false
      sub.remove()
    }
  }, [refreshPermissions])

  const pushBlockedBySystem = useMemo(() => {
    if (!permissions) return false
    return !permissions.granted && permissions.canAskAgain === false
  }, [permissions])

  // If the system permission is currently off (even if ask-again is allowed), ensure we don't display push as enabled.
  useEffect(() => {
    if (!permissions) return
    if (permissions.granted) return
    if (!pushEnabled && !expoPushToken) return
    setPushPreference(false, null)
  }, [permissions, pushEnabled, expoPushToken, setPushPreference])

  useEffect(() => {
    if (pushBlockedBySystem && pushEnabled) {
      ;(async () => {
        try {
          if (expoPushToken && WORKER_URL) {
            await fetch(`${WORKER_URL}/api/unregister`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: expoPushToken }),
            })
          }
        } catch (err) {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.warn("[push] failed to unregister token after system block", err)
          }
        } finally {
          setPushPreference(false, null)
        }
      })()
    }
  }, [expoPushToken, pushBlockedBySystem, pushEnabled, setPushPreference])

  useEffect(() => {
    if (!permissions?.granted) return
    if (pushEnabled) return
    if (autoEnabledRef.current) return
    autoEnabledRef.current = true
    // Mirror system permission by enabling in-app toggle; usePushToken will register.
    setPushPreference(true, expoPushToken ?? null)
  }, [permissions?.granted, pushEnabled, setPushPreference, expoPushToken])

  const openSystemSettings = useCallback(() => {
    Linking.openSettings().catch(() => {})
  }, [])

  const registerForPush = useCallback(async () => {
    setIsChecking(true)
    try {
      const result = await requestPushPermissionsAndToken()
      setPermissions(result.status)
      return { granted: result.granted, token: result.token }
    } finally {
      setIsChecking(false)
    }
  }, [])

  const handleTogglePush = useCallback(
    async (next: boolean) => {
      if (!next) {
        if (expoPushToken) {
          try {
            if (WORKER_URL) {
              await fetch(`${WORKER_URL}/api/unregister`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: expoPushToken }),
              })
            }
          } catch (err) {
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.warn("[push] failed to unregister token", err)
            }
          }
        }
        setPushPreference(false, null)
        show({ title: "Push notifications disabled", type: "info" })
        return
      }

      if (pushBlockedBySystem) {
        show({ title: "Enable notifications in device settings", type: "info" })
        openSystemSettings()
        return
      }

      try {
        const result = await registerForPush()
        if (!result.granted) {
          show({
            title: "Enable notifications",
            type: "info",
          })
          if (Platform.OS === "ios") {
            openSystemSettings()
          }
          setPushPreference(false, null)
          return
        }

        setPushPreference(true, result.token)
        show({ title: "Push notifications enabled", type: "success" })
      } catch (err: any) {
        const message = err?.message ?? "Could not update push notifications."
        show({ title: message, type: "danger" })
        setPushPreference(false, null)
      }
    },
    [registerForPush, setPushPreference, show, pushBlockedBySystem, openSystemSettings, expoPushToken],
  )

  const handleToggleEmail = useCallback(
    (next: boolean) => {
      setPreferences({ emailEnabled: next })
      show({ title: next ? "Email notifications on" : "Email notifications off", type: "info" })
    },
    [setPreferences, show],
  )

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1 bg-[#f8fafc]">
      <View className="px-5 pt-6 gap-6">
        <View className="gap-2">
          <Text className="text-[#0f172a] font-geist-semibold text-[22px]">Notifications</Text>
          <Text className="text-[#475569] text-[14px] leading-[20px]">
            Decide how you’d like to hear from OptionQaaf across push, email, and SMS.
          </Text>
        </View>

        <View className="gap-4">
          <PreferenceToggle
            title="Push notifications"
            description="Get real-time alerts about orders and exclusive drops."
            value={pushEnabled && !pushBlockedBySystem}
            onValueChange={handleTogglePush}
            disabled={pushBlockedBySystem || isChecking}
          />
          {pushBlockedBySystem ? (
            <Card padding="lg" className="bg-[#f1f5f9]">
              <Text className="text-[#0f172a] font-geist-semibold text-[14px]">Push notifications blocked</Text>
              <Text className="text-[#475569] text-[13px] leading-[19px]">
                Notifications are turned off from your device settings. Enable them in system settings to receive push
                alerts.
              </Text>
              <Button variant="outline" size="sm" className="mt-3" onPress={openSystemSettings} fullWidth>
                Open device settings
              </Button>
            </Card>
          ) : null}

          <PreferenceToggle
            title="Email updates"
            description="Stay on top of receipts, delivery updates, and personalised picks."
            value={emailEnabled}
            onValueChange={handleToggleEmail}
          />
        </View>
      </View>
    </ScrollView>
  )
}

type PreferenceToggleProps = {
  title: string
  description: string
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
}

function PreferenceToggle({ title, description, value, onValueChange, disabled }: PreferenceToggleProps) {
  return (
    <Card padding="lg" className="flex-row items-center gap-4">
      <View className="flex-1 gap-1">
        <Text className="text-[#0f172a] font-geist-semibold text-[15px]">{title}</Text>
        <Text className="text-[#475569] text-[13px] leading-[18px]">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#cbd5f5", true: "#0f172a" }}
        thumbColor={Platform.OS === "android" ? (value ? "#ffffff" : "#f8fafc") : undefined}
        ios_backgroundColor="#cbd5f5"
      />
    </Card>
  )
}
