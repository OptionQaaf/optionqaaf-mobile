import { useMobileHome } from "@/features/home/api"
import { useSearch } from "@/features/search/api"
import { MetaobjectSectionList } from "@/ui/home/sections/MetaobjectSectionList"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { ProductTile } from "@/ui/product/ProductTile"
import { StaticProductGrid } from "@/ui/product/StaticProductGrid"
import { router, useLocalSearchParams } from "expo-router"
import { Linking, Text, View } from "react-native"

const ABSOLUTE_RE = /^(https?:|mailto:|tel:|sms:)/i

const PAGE_CONFIG: Record<string, { homeHandle: string; title: string; searchQuery: string }> = {
  "men-1": { homeHandle: "men-home", title: "Men", searchQuery: "men" },
  "women-1": { homeHandle: "women-home", title: "Women", searchQuery: "women" },
}

export default function CustomPage() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const h = String(handle || "")
  const cfg = PAGE_CONFIG[h] ?? { homeHandle: h, title: h, searchQuery: h }

  const { data: homeData } = useMobileHome(cfg.homeHandle)
  const sections = homeData?.sections ?? []

  const { data: searchData } = useSearch(cfg.searchQuery, 24)
  const products = (searchData?.pages?.flatMap((p) => p.nodes) ?? []).slice(0, 24)

  const go = (url?: string) => {
    if (!url) return
    if (ABSOLUTE_RE.test(url)) Linking.openURL(url)
    else router.push(url as any)
  }

  return (
    <Screen bleedTop bleedBottom>
      <View className="flex-1">
        <MenuBar variant="light" floating back />

        <PageScrollView contentContainerStyle={{ paddingBottom: 16 }} contentContainerClassName="bg-white">
          <View className="pt-0">
            {/* Aesthetic sections (reuse home metaobject) */}
            <MetaobjectSectionList sections={sections} onNavigate={go} />

            {/* PLP grid vibe */}
            <View className="px-3 mt-4">
              <Text className="text-[22px] font-extrabold text-primary mb-2">{cfg.title}</Text>
              <StaticProductGrid
                data={products}
                columns={2}
                renderItem={(item: any, w: number) => (
                  <ProductTile
                    image={item?.featuredImage?.url ?? ""}
                    brand={item?.vendor ?? ""}
                    title={item?.title ?? ""}
                    price={Number(item?.priceRange?.minVariantPrice?.amount ?? 0)}
                    compareAt={undefined}
                    currency={(item?.priceRange?.minVariantPrice?.currencyCode as any) ?? "USD"}
                    width={w}
                    imageRatio={3 / 4}
                    padding="md"
                    onPress={() => item?.handle && router.push(`/products/${item.handle}` as any)}
                  />
                )}
              />
            </View>
          </View>
        </PageScrollView>
      </View>
    </Screen>
  )
}
