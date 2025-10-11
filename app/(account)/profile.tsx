import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { customerGraphQL } from "@/lib/shopify/customer/client"
import { MeProfileDocument, type MeProfileQuery } from "@/lib/shopify/customer/gql/graphql"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { H2, Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { useQuery } from "@tanstack/react-query"
import { Image } from "expo-image"
import { useMemo } from "react"
import { ActivityIndicator, View } from "react-native"

export default function ProfileScreen() {
  const { isAuthenticated, login, logout } = useShopifyAuth()

  const query = useQuery({
    queryKey: ["customer", "me", "profile"],
    queryFn: () => customerGraphQL<MeProfileQuery>(MeProfileDocument),
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) {
    return (
      <Screen>
        <MenuBar back />
        <View className="flex-1 items-center justify-center gap-6 px-8">
          <H2 className="text-center">Sign in to view your profile</H2>
          <Button size="lg" onPress={login} accessibilityLabel="Sign in to Shopify">
            Sign in
          </Button>
        </View>
      </Screen>
    )
  }

  const profile = query.data?.customer ?? null
  const fullName = useMemo(() => {
    if (!profile) return null
    if (profile.displayName) return profile.displayName
    const parts = [profile.firstName, profile.lastName].filter(Boolean)
    if (parts.length === 0) return null
    return parts.join(" ")
  }, [profile])
  const creationDate = useMemo(() => {
    if (!profile?.creationDate) return null
    const d = new Date(profile.creationDate)
    if (Number.isNaN(d.getTime())) return profile.creationDate
    return d.toLocaleDateString()
  }, [profile?.creationDate])

  return (
    <Screen>
      <MenuBar back />
      <PageScrollView contentContainerClassName="px-5 py-6">
        <View className="gap-5">
          <View className="gap-2">
            <H2>Profile</H2>
            <Muted>Your Shopify customer details synced from the Customer Account API.</Muted>
          </View>

          <Card padding="lg" className="gap-4">
            {query.isLoading ? (
              <View className="py-8 items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : profile ? (
              <View className="gap-4">
                <Avatar imageUrl={profile.imageUrl} name={profile.displayName || profile.firstName || ""} />
                <View className="gap-3">
                  <ProfileRow label="Name" value={fullName ?? "—"} />
                  <ProfileRow label="Email" value={profile.emailAddress?.emailAddress ?? "—"} />
                  <ProfileRow label="Phone" value={profile.phoneNumber?.number ?? "—"} />
                  <ProfileRow label="Customer since" value={creationDate ?? "—"} />
                </View>
              </View>
            ) : (
              <View className="py-8">
                <Muted>No profile information available.</Muted>
              </View>
            )}
          </Card>

          <Button variant="outline" onPress={logout} accessibilityLabel="Sign out of Shopify">
            Log out
          </Button>
        </View>
      </PageScrollView>
    </Screen>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-1">
      <Muted className="text-[13px] uppercase tracking-wide">{label}</Muted>
      <Text className="text-[16px]">{value}</Text>
    </View>
  )
}

function Avatar({ imageUrl, name }: { imageUrl?: string | null; name?: string | null }) {
  if (imageUrl) {
    return (
      <View className="items-center">
        <Image
          source={{ uri: imageUrl }}
          style={{ width: 96, height: 96, borderRadius: 48 }}
          contentFit="cover"
        />
      </View>
    )
  }

  const letter = typeof name === "string" && name.trim() ? name.trim().charAt(0).toUpperCase() : "?"
  return (
    <View className="w-24 h-24 rounded-full bg-neutral-200 items-center justify-center self-center">
      <Text className="text-[32px] font-geist-semibold text-primary">{letter}</Text>
    </View>
  )
}
