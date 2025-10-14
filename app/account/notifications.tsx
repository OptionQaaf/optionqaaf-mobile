import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useNotificationSettings } from "@/store/notifications"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Card } from "@/ui/surfaces/Card"
import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Platform, ScrollView, Switch, Text, View } from "react-native"

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
  const { pushEnabled, emailEnabled, smsEnabled, setPreferences, setPushPreference } = useNotificationSettings()
  const { show } = useToast()
  const [permissions, setPermissions] = useState<PermissionsStatus | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const status = await Notifications.getPermissionsAsync()
        if (mounted) setPermissions(status)
      } catch {
        if (mounted) setPermissions(null)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const pushBlockedBySystem = useMemo(() => {
    if (!permissions) return false
    return !permissions.granted && permissions.canAskAgain === false
  }, [permissions])

  useEffect(() => {
    if (pushBlockedBySystem && pushEnabled) {
      setPushPreference(false, null)
    }
  }, [pushBlockedBySystem, pushEnabled, setPushPreference])

  const registerForPush = useCallback(async () => {
    setIsChecking(true)
    try {
      let status = await Notifications.getPermissionsAsync()

      if (!status.granted && status.canAskAgain) {
        status = await Notifications.requestPermissionsAsync()
      }

      setPermissions(status)

      if (!status.granted) {
        return { granted: false as const, token: null }
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.DEFAULT,
        })
      }

      const projectId = Constants?.easConfig?.projectId ?? Constants?.expoConfig?.extra?.eas?.projectId
      const tokenResponse = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync()

      return { granted: true as const, token: tokenResponse.data }
    } finally {
      setIsChecking(false)
    }
  }, [])

  const handleTogglePush = useCallback(
    async (next: boolean) => {
      if (!next) {
        setPushPreference(false, null)
        show({ title: "Push notifications disabled", type: "info" })
        return
      }

      try {
        const result = await registerForPush()
        if (!result.granted) {
          show({
            title: "Enable notifications",
            message: "Turn on push notifications in your system settings to stay up to date.",
            type: "warning",
          })
          setPushPreference(false, null)
          return
        }

        setPushPreference(true, result.token)
        show({ title: "Push notifications enabled", type: "success" })
      } catch (err: any) {
        const message = err?.message ?? "Could not update push notifications."
        show({ title: message, type: "danger" })
      }
    },
    [registerForPush, setPushPreference, show],
  )

  const handleToggleEmail = useCallback(
    (next: boolean) => {
      setPreferences({ emailEnabled: next })
      show({ title: next ? "Email notifications on" : "Email notifications off", type: "info" })
    },
    [setPreferences, show],
  )

  const handleToggleSms = useCallback(
    (next: boolean) => {
      setPreferences({ smsEnabled: next })
      show({ title: next ? "SMS notifications on" : "SMS notifications off", type: "info" })
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
            </Card>
          ) : null}

          <PreferenceToggle
            title="Email updates"
            description="Stay on top of receipts, delivery updates, and personalised picks."
            value={emailEnabled}
            onValueChange={handleToggleEmail}
          />

          <PreferenceToggle
            title="SMS messages"
            description="Receive delivery alerts and time-sensitive reminders."
            value={smsEnabled}
            onValueChange={handleToggleSms}
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
