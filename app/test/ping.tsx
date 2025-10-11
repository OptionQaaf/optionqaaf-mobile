import { shopifyClient } from "@/lib/shopify/client"
import { PingShopNameDocument, type PingShopNameQuery } from "@/lib/shopify/gql/graphql"
import { useQuery } from "@tanstack/react-query"
import { Text, View } from "react-native"

export default function PingScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ping-shop"],
    queryFn: async () => shopifyClient.request<PingShopNameQuery>(PingShopNameDocument, {}),
  })

  if (isLoading)
    return (
      <View style={{ padding: 16 }}>
        <Text>Loading…</Text>
      </View>
    )
  if (error)
    return (
      <View style={{ padding: 16 }}>
        <Text>Error: {(error as Error).message}</Text>
      </View>
    )

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18 }}>Shop name:</Text>
      <Text style={{ fontSize: 24, fontWeight: "600" }}>{data?.shop?.name}</Text>
    </View>
  )
}
