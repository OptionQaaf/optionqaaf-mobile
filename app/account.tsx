import { useCustomerProfile } from "@/features/account/api"
import { avatarFromProfile } from "@/features/account/avatar"
import { isDeletionRequestPending } from "@/features/account/deletion"
import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { AuthGate } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { qk } from "@/lib/shopify/queryKeys"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Card } from "@/ui/surfaces/Card"
import { RelativePathString, useRouter } from "expo-router"
import { Heart, LogOut, MapPin, Package, Pencil, Settings2 } from "lucide-react-native"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
  const { logout, isAuthenticated, token } = useShopifyAuth()
  const { show } = useToast()
  const qc = useQueryClient()
  const lastTokenRef = useRef<string | null | undefined>(null)
  const [deletionPending, setDeletionPending] = useState(false)
  const [deletionPendingLoaded, setDeletionPendingLoaded] = useState(false)
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
  const showProfileSkeleton = (isLoading && !profile) || !deletionPendingLoaded
  const deletionCacheRef = useRef(new Map<string, boolean>())

  useEffect(() => {
    if (!isAuthenticated) return
    if (token && token !== lastTokenRef.current) {
      lastTokenRef.current = token
      qc.removeQueries({ queryKey: qk.customerProfile() })
      refetch()
    }
  }, [isAuthenticated, qc, refetch, token])

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

  type LinkConfig = {
    title: string
    body: string
    Icon: typeof Package
    path: RelativePathString
  }

  const quickLinks = useMemo<LinkConfig[]>(
    () => [
      {
        title: "Orders",
        body: "Track deliveries, returns, and receipts.",
        Icon: Package,
        path: "/account/orders" as RelativePathString,
      },
      {
        title: "Wishlist",
        body: "All the products you’ve bookmarked.",
        Icon: Heart,
        path: "/account/wishlist" as RelativePathString,
      },
      {
        title: "Addresses",
        body: "Manage shipping and pickup spots.",
        Icon: MapPin,
        path: "/account/addresses" as RelativePathString,
      },
    ],
    [],
  )

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

  const accountName = useMemo(() => {
    const first = profile?.firstName?.trim() ?? ""
    const last = profile?.lastName?.trim() ?? ""
    if (first || last) return `${first} ${last}`.trim()
    const display = profile?.displayName ?? ""
    const email = profile?.email ?? ""
    const source = display || email
    if (source.includes("@")) {
      const [local] = source.split("@")
      if (local?.trim()) return local.trim()
    }
    return source || "Your account"
  }, [profile?.displayName, profile?.email, profile?.firstName, profile?.lastName])

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
      className="bg-[#f8fafc]"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#111827" />}
    >
      <View className="px-5 pt-6 pb-4 gap-7 flex-1">
        {deletionPending ? (
          <Card padding="lg" className="border border-[#fecaca] bg-[#fef2f2] gap-2">
            <Text className="text-[#991b1b] font-geist-semibold text-[15px]">
              This account is going through deletion.
            </Text>
            <Text className="text-[#b91c1c] text-[13px] leading-[18px]">
              Your account and all data will be permanently deleted soon. Any changes or activity will be lost.
            </Text>
          </Card>
        ) : null}
        <Card padding="lg" className="gap-5">
          {showProfileSkeleton ? (
            <AccountHeaderSkeleton />
          ) : (
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
                      {isLoading && !profile ? "Loading account…" : accountName}
                    </Text>
                    <Text className="text-[#475569] text-[14px] leading-[20px]">{contactLine}</Text>
                    {memberSince ? (
                      <Text className="text-[#94a3b8] text-[12px] leading-[18px]">Member since {memberSince}</Text>
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <PressableOverlay
                      onPress={() => router.push("/account/edit" as const)}
                      className="h-10 w-10 rounded-2xl bg-[#e2e8f0] items-center justify-center"
                    >
                      <Pencil size={18} color="#0f172a" />
                    </PressableOverlay>
                    <PressableOverlay
                      onPress={() => router.push("/account/settings" as const)}
                      className="h-10 w-10 rounded-2xl bg-[#e2e8f0] items-center justify-center"
                    >
                      <Settings2 size={18} color="#0f172a" />
                    </PressableOverlay>
                  </View>
                </View>
              </View>
            </View>
          )}
        </Card>

        <Section title="Quick access">
          <View className="gap-3">
            {showProfileSkeleton
              ? Array.from({ length: Math.max(quickLinks.length, 3) }).map((_, idx) => (
                  <AccountLinkSkeleton key={`quick-link-skel-${idx}`} />
                ))
              : quickLinks.map((link) => (
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

        <View className="pt-8 gap-2" style={{ marginTop: "auto" }}>
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

function AccountHeaderSkeleton() {
  return (
    <View className="flex-row items-center gap-4">
      <Skeleton className="h-14 w-14 rounded-md" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-5 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <Skeleton className="h-3 w-1/3 rounded-md" />
      </View>
      <Skeleton className="h-10 w-10 rounded-2xl" />
    </View>
  )
}

function AccountLinkSkeleton() {
  return (
    <Card padding="lg" className="flex-row items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-2xl" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-3/5 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </View>
    </Card>
  )
}
