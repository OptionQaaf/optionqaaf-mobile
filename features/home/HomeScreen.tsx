import { useMobileHome } from "@/features/home/api"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { MetaobjectSectionList } from "@/ui/home/sections/MetaobjectSectionList"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect, useRef } from "react"
import type { ScrollView } from "react-native"
import { DeviceEventEmitter, Linking, View } from "react-native"

const ABSOLUTE_RE = /^(https?:|mailto:|tel:|sms:)/i

export default function HomeScreen() {
  const { data, isLoading } = useMobileHome("app-home")
  const sections = data?.sections ?? []
  const scrollRef = useRef<ScrollView>(null)

  const go = (url?: string) => {
    if (!url) return
    if (ABSOLUTE_RE.test(url)) Linking.openURL(url)
    else router.push(url as any)
  }

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("home:scrollToTop", () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    })
    return () => sub.remove()
  }, [])

  return (
    <Screen bleedTop bleedBottom>
      <StatusBar style="dark" />
      <View className="flex-1">
        {/* <MenuBar floating /> */}

        {isLoading ? (
          <PageScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 0 }}>
            <View className="pt-0">
              <Skeleton className="h-[360px] w-full" />
              <Skeleton className="h-[44px] w-full" />
              <Skeleton className="h-[220px] w-full" />
              <Skeleton className="h-[180px] w-full" />
            </View>
          </PageScrollView>
        ) : (
          <PageScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 0 }}>
            <MetaobjectSectionList sections={sections} onNavigate={go} />
          </PageScrollView>
        )}
      </View>
    </Screen>
  )
}
