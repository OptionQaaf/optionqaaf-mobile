import { useCustomerProfile } from "@/features/account/api"
import { avatarFromProfile } from "@/features/account/avatar"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Card } from "@/ui/surfaces/Card"
import { useRouter } from "expo-router"
import { CreditCard, Heart, LogOut, MapPin, Package, Pencil, Settings2, ShieldCheck } from "lucide-react-native"
import { useCallback, useEffect, useMemo, type ReactNode } from "react"
import { RefreshControl, ScrollView, Text, View } from "react-native"

export default function AccountScreen() {
  const router = useRouter()

  return (
    <AuthGate requireAuth fallback={<AccountSignInFallback onSuccess={() => router.replace("/account" as const)} />}>
      <Screen bleedBottom>
        <MenuBar />
        <AccountContent />
      </Screen>
    </AuthGate>
  )
}

function AccountContent() {
  const router = useRouter()
  const { logout, isAuthenticated } = useShopifyAuth()
  const { show } = useToast()
  const {
    data: profile,
    isLoading,
    error,
    isRefetching,
    refetch,
  } = useCustomerProfile({
    enabled: isAuthenticated,
  })

  const avatar = useMemo(() => avatarFromProfile(profile), [profile])

  const handleLogout = useCallback(async () => {
    try {
      await logout()
      router.replace("/home" as const)
      show({ title: "Signed out", type: "info" })
    } catch (err: any) {
      const message = err?.message || "Could not sign out. Try again."
      show({ title: message, type: "danger" })
    }
  }, [logout, router, show])

  const quickLinks = useMemo(
    () => [
      {
        title: "Orders",
        body: "Track deliveries, returns, and receipts.",
        Icon: Package,
        path: "/account/orders" as const,
      },
      {
        title: "Wishlist",
        body: "All the products you’ve bookmarked.",
        Icon: Heart,
        path: "/account/wishlist" as const,
      },
      {
        title: "Addresses",
        body: "Manage shipping and pickup spots.",
        Icon: MapPin,
        path: "/account/addresses" as const,
      },
      {
        title: "Payment & preferences",
        body: "Update saved cards and fit preferences.",
        Icon: CreditCard,
      },
    ],
    [],
  )

  const supportLinks = useMemo(
    () => [
      {
        title: "Security",
        body: "Review devices and sign-in history.",
        Icon: ShieldCheck,
      },
      {
        title: "Notifications",
        body: "Control messages, offers, and alerts.",
        Icon: Settings2,
      },
    ],
    [],
  )

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Could not load profile"
      show({ title: message, type: "danger" })
    }
  }, [error, show])

  const memberSince = useMemo(() => {
    if (!profile?.creationDate) return null
    const date = new Date(profile.creationDate)
    if (Number.isNaN(date.getTime())) return null
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
    } catch {
      return date.toISOString().split("T")[0]
    }
  }, [profile?.creationDate])

  const contactLine = useMemo(() => {
    if (profile?.email) return profile.email
    if (profile?.phone) return profile.phone
    return isLoading ? "Loading profile…" : "Keep your contact details in sync across devices."
  }, [profile?.email, profile?.phone, isLoading])

  const handleComingSoon = useCallback((label: string) => show({ title: `${label} coming soon`, type: "info" }), [show])

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 32 }}
      className="bg-[#f8fafc]"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#111827" />}
    >
      <View className="px-5 pt-6 pb-4 gap-7">
        <Card padding="lg" className="gap-5">
          <View className="flex-row items-center gap-4">
            <View
              className="h-14 w-14 rounded-full items-center justify-center"
              style={{ backgroundColor: avatar.color }}
            >
              <Text className="text-white font-geist-semibold text-[18px]">{avatar.initials}</Text>
            </View>
            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-[#0f172a] font-geist-semibold text-[18px]">
                    {profile?.displayName || (isLoading ? "Loading account…" : "Your account")}
                  </Text>
                  <Text className="text-[#475569] text-[14px] leading-[20px]">{contactLine}</Text>
                  {memberSince ? (
                    <Text className="text-[#94a3b8] text-[12px] leading-[18px]">Member since {memberSince}</Text>
                  ) : null}
                </View>
                <PressableOverlay
                  onPress={() => router.push("/account/edit" as const)}
                  className="h-10 w-10 rounded-2xl bg-[#e2e8f0] items-center justify-center"
                >
                  <Pencil size={18} color="#0f172a" />
                </PressableOverlay>
              </View>
            </View>
          </View>
        </Card>

        <Section title="Quick access">
          <View className="gap-3">
            {quickLinks.map((link) => {
              const onPress = link.path ? () => router.push(link.path) : () => handleComingSoon(link.title)
              return (
                <AccountLink
                  key={link.title}
                  title={link.title}
                  description={link.body}
                  icon={<link.Icon color="#1f2937" size={20} strokeWidth={2} />}
                  onPress={onPress}
                />
              )
            })}
          </View>
        </Section>

        <Section title="Account settings">
          <View className="gap-3">
            {supportLinks.map((link) => (
              <AccountLink
                key={link.title}
                title={link.title}
                description={link.body}
                icon={<link.Icon color="#1f2937" size={20} strokeWidth={2} />}
                onPress={() => handleComingSoon(link.title)}
              />
            ))}
          </View>
        </Section>

        <Button
          variant="outline"
          size="lg"
          fullWidth
          onPress={handleLogout}
          leftIcon={<LogOut color="#111827" size={18} strokeWidth={2} />}
        >
          Sign out
        </Button>
      </View>
    </ScrollView>
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
    <PressableOverlay onPress={onPress} className="rounded-2xl">
      <Card padding="lg" className="flex-row items-center gap-4">
        <View className="h-12 w-12 rounded-2xl bg-[#f1f5f9] items-center justify-center">{icon}</View>
        <View className="flex-1 gap-1">
          <Text className="text-[#0f172a] font-geist-semibold text-[15px]">{title}</Text>
          <Text className="text-[#475569] text-[13px] leading-[18px]">{description}</Text>
        </View>
      </Card>
    </PressableOverlay>
  )
}
