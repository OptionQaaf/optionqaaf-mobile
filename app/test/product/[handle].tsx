import { shopifyClient } from "@/lib/shopify/client";
import { ProductByHandleDocument, type ProductByHandleQuery } from "@/lib/shopify/gql/graphql";
import { currentLocale } from "@/store/prefs";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";

export default function ProductTestScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const locale = currentLocale();

  const { data, isLoading, error } = useQuery({
    queryKey: ["test-product", handle, locale],
    enabled: !!handle,
    queryFn: async () =>
      shopifyClient.request<ProductByHandleQuery>(ProductByHandleDocument, {
        handle: handle!,
        country: locale.country as any,
        language: locale.language as any,
      }),
  });

  if (isLoading) return <View style={{ padding: 16 }}><Text>Loading…</Text></View>;
  if (error)     return <View style={{ padding: 16 }}><Text>Error: {(error as Error).message}</Text></View>;

  const p = data?.product;
  if (!p) return <View style={{ padding: 16 }}><Text>Not found</Text></View>;

  const img = p.featuredImage;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>{p.title}</Text>
      {img?.url ? (
        <Image source={{ uri: img.url }} style={{ width: "100%", height: 300, borderRadius: 12, marginBottom: 12 }} />
      ) : null}
      <Text>{p.vendor}</Text>
      <Text style={{ opacity: 0.7, marginTop: 8 }}>{p.description}</Text>
    </ScrollView>
  );
}
