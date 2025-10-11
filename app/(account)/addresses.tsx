import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { customerGraphQL } from "@/lib/shopify/customer/client"
import {
  MeAddressesDocument,
  type MeAddressesQuery,
  type MeAddressesQueryVariables,
} from "@/lib/shopify/customer/gql/graphql"
import { AccountSectionHeading } from "./components"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Button } from "@/ui/primitives/Button"
import { Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { useQuery } from "@tanstack/react-query"
import { ActivityIndicator, View } from "react-native"

const PAGE_SIZE = 20

export default function AddressesScreen() {
  const { isAuthenticated, login } = useShopifyAuth()

  const query = useQuery({
    queryKey: ["customer", "me", "addresses"],
    queryFn: () =>
      customerGraphQL<MeAddressesQuery, MeAddressesQueryVariables>(MeAddressesDocument, { first: PAGE_SIZE }),
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) {
    return (
      <Screen>
        <MenuBar back />
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-[20px] font-geist-semibold text-center">Sign in to manage your addresses</Text>
          <Button size="lg" onPress={login} accessibilityLabel="Sign in to Shopify">
            Sign in
          </Button>
        </View>
      </Screen>
    )
  }

  const customer = query.data?.customer
  const defaultAddress = customer?.defaultAddress ?? null
  const nodes = customer?.addresses?.nodes ?? []

  return (
    <Screen>
      <MenuBar back />
      <PageScrollView contentContainerClassName="px-6 py-8">
        <View className="gap-6">
          <AccountSectionHeading title="Addresses" description="Manage where we ship your orders." />

          {query.isLoading ? (
            <Card padding="lg" className="items-center py-8 bg-white">
              <ActivityIndicator />
            </Card>
          ) : (
            <View className="gap-4">
              {defaultAddress ? (
                <Card padding="lg" className="gap-3 bg-white border border-primary/20">
                  <Muted className="uppercase text-[12px] tracking-wide text-primary">Default address</Muted>
                  <AddressBlock address={defaultAddress} />
                </Card>
              ) : null}

              {nodes.length > 0 ? (
                nodes.map((addr) => (
                  <Card key={addr.id} padding="lg" className="gap-3 bg-white">
                    <AddressBlock address={addr} />
                  </Card>
                ))
              ) : (
                <Card padding="lg" className="bg-white">
                  <Muted>No saved addresses yet.</Muted>
                </Card>
              )}
            </View>
          )}
        </View>
      </PageScrollView>
    </Screen>
  )
}

type Address = NonNullable<MeAddressesQuery["customer"]>["addresses"]["nodes"][number]

type AddressLike = Address | NonNullable<MeAddressesQuery["customer"]>["defaultAddress"]

function AddressBlock({ address }: { address: AddressLike }) {
  const lines = [
    address.name,
    address.address1,
    address.address2,
    [address.city, address.province].filter(Boolean).join(", "),
    [address.country, address.zip].filter(Boolean).join(" "),
  ].filter((line) => !!line && line.toString().trim().length > 0)

  return (
    <View className="gap-1">
      {lines.length > 0 ? (
        lines.map((line, idx) => (
          <Text key={`${address.id}-${idx}`} className="text-[15px]">
            {line}
          </Text>
        ))
      ) : (
        <Muted>Address details unavailable.</Muted>
      )}
    </View>
  )
}
