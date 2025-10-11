import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { customerGraphQL } from "@/lib/shopify/customer/client"
import { MeProfileDocument, type MeProfileQuery } from "@/lib/shopify/customer/gql/graphql"
import {
  AccountInfoRow,
  AccountSectionHeading,
  AccountSummaryCard,
  formatCreationDate,
  formatFullName,
} from "./components"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { useQuery } from "@tanstack/react-query"
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
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-[20px] font-geist-semibold text-center">Sign in to view your profile</Text>
          <Button size="lg" onPress={login} accessibilityLabel="Sign in to Shopify">
            Sign in
          </Button>
        </View>
      </Screen>
    )
  }

  const profile = query.data?.customer ?? null
  const fullName = formatFullName(profile)
  const creationDate = formatCreationDate(profile?.creationDate)

  return (
    <Screen>
      <MenuBar back />
      <PageScrollView contentContainerClassName="px-6 py-8">
        <View className="gap-6">
          <AccountSummaryCard
            person={{
              subtitle: "Account",
              name: fullName ?? profile?.displayName ?? "",
              email: profile?.emailAddress?.emailAddress ?? undefined,
              phone: profile?.phoneNumber?.number ?? undefined,
              imageUrl: profile?.imageUrl ?? undefined,
            }}
            footer={
              query.isLoading ? (
                <View className="py-6 items-center">
                  <ActivityIndicator />
                </View>
              ) : profile ? (
                <View className="flex-row flex-wrap gap-6">
                  <AccountInfoRow label="First name" value={profile.firstName} />
                  <AccountInfoRow label="Last name" value={profile.lastName} />
                  <AccountInfoRow label="Customer since" value={creationDate} />
                </View>
              ) : (
                <Muted>No profile information available.</Muted>
              )
            }
          />

          <Card padding="lg" className="gap-4 bg-white">
            <AccountSectionHeading
              title="Session"
              description="Manage your Shopify Customer Account access on this device."
            />
            <Button variant="outline" onPress={logout} accessibilityLabel="Sign out of Shopify">
              Log out
            </Button>
          </Card>
        </View>
      </PageScrollView>
    </Screen>
  )
}
