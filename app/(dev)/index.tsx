import { getCustomerApiConfigOverride, getOpenIdConfigOverride } from "@/lib/shopify/customer/discovery"
import { Screen } from "@/ui/layout/Screen"
import { H1, Text } from "@/ui/primitives/Typography"
import { Link } from "expo-router"
import { View } from "react-native"

export default function DevHome() {
  const openIdOverride = getOpenIdConfigOverride()
  const customerOverride = getCustomerApiConfigOverride()

  return (
    <Screen>
      <View className="p-6 gap-3">
        <H1>Dev</H1>
        <Link href="/(dev)/playground">
          <Text className="underline text-primary">Component Playground</Text>
        </Link>
        <Link href="/(dev)/pdp-demo">
          <Text className="underline text-primary">PDP Demo</Text>
        </Link>
        <View className="mt-4 gap-1">
          <Text className="font-geist-semibold">Discovery overrides</Text>
          <Text className="text-secondary text-[14px]">OpenID: {openIdOverride ? "enabled" : "disabled"}</Text>
          {openIdOverride ? (
            <Text className="text-secondary text-[13px]">authorize → {openIdOverride.authorization_endpoint}</Text>
          ) : null}
          <Text className="text-secondary text-[14px]">Customer API: {customerOverride ? "enabled" : "disabled"}</Text>
          {customerOverride ? (
            <Text className="text-secondary text-[13px]">graphql → {customerOverride.graphql_api}</Text>
          ) : null}
        </View>
      </View>
    </Screen>
  )
}
