import { AuthGate, SignInPrompt } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { useToast } from "@/ui/feedback/Toast"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Card } from "@/ui/surfaces/Card"
import { Button } from "@/ui/primitives/Button"
import { useRouter } from "expo-router"
import { Package, Heart, MapPin, Settings2, ShieldCheck, CreditCard, LogOut, UserRound } from "lucide-react-native"
import { useCallback, useMemo, type ReactNode } from "react"
import { ScrollView, Text, View } from "react-native"

export default function AccountScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={
        <SignInPrompt
          title="Sign in to your account"
          description="Unlock your orders, wishlist, and saved checkout details in one place."
          buttonLabel="Sign in with Shopify"
          onSuccess={() => router.replace("/account" as const)}
        />
      }
    >
      <Screen bleedBottom>
        <MenuBar />
        <AccountContent />
      </Screen>
    </AuthGate>
  )
}

function AccountContent() {
  const router = useRouter()
  const { logout } = useShopifyAuth()
  const { show } = useToast()

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
      },
      {
        title: "Wishlist",
        body: "All the products you’ve bookmarked.",
        Icon: Heart,
      },
      {
        title: "Addresses",
        body: "Manage shipping and pickup spots.",
        Icon: MapPin,
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

  const handleComingSoon = useCallback((label: string) => show({ title: `${label} coming soon`, type: "info" }), [show])

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className="bg-[#f8fafc]">
      <View className="px-5 pt-6 pb-4 gap-7">
        <Card padding="lg" className="gap-5">
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 rounded-full bg-[#111827] items-center justify-center">
              <UserRound color="#f8fafc" size={24} strokeWidth={2} />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-[#0f172a] font-geist-semibold text-[18px]">Your account</Text>
              <Text className="text-[#475569] text-[14px] leading-[20px]">
                Orders, wishlist, and saved details stay in sync across devices.
              </Text>
            </View>
          </View>
          <View className="flex-row gap-3">
            <AccountStat label="Orders" value="—" />
            <AccountStat label="Wishlist" value="—" />
            <AccountStat label="Rewards" value="—" />
          </View>
        </Card>

        <Section title="Quick access">
          <View className="gap-3">
            {quickLinks.map((link) => (
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

function AccountStat({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md" className="flex-1 gap-1 bg-[#f8fafc]">
      <Text className="text-[#64748b] text-[12px] uppercase tracking-[1.5px]">{label}</Text>
      <Text className="text-[#0f172a] text-[20px] font-geist-semibold">{value}</Text>
    </Card>
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
