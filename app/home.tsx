import { useMobileHome } from "@/features/home/api"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { sectionRegistry } from "@/ui/home/sections/registry"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Linking, ScrollView, View } from "react-native"

const ABSOLUTE_RE = /^(https?:|mailto:|tel:|sms:)/i

export default function Home() {
  const { data, isLoading } = useMobileHome("app-home")
  const sections = data?.sections ?? []

  const go = (url?: string) => {
    if (!url) return
    if (ABSOLUTE_RE.test(url)) Linking.openURL(url)
    else router.push(url as any)
  }

  return (
    <Screen bleedTop bleedBottom>
      <StatusBar style="light" />
      <View className="flex-1">
        <MenuBar variant="light" floating />

        {isLoading ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 0 }}>
            <View className="pt-0">
              <Skeleton className="h-[360px] w-full" />
              <Skeleton className="h-[44px] w-full" />
              <Skeleton className="h-[220px] w-full" />
              <Skeleton className="h-[180px] w-full" />
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 0 }}>
            <View className="pt-0">
              {sections.map((s) => {
                const Cmp = (sectionRegistry as any)[s.kind]
                if (!Cmp) return null

                switch (s.kind) {
                  case "duo_poster":
                    return (
                      <Cmp
                        key={s.id}
                        {...(s as any)}
                        onPressLeft={() => go(s.left?.url)}
                        onPressRight={() => go(s.right?.url)}
                      />
                    )
                  case "trio_grid":
                    return (
                      <Cmp
                        key={s.id}
                        {...(s as any)}
                        onPressA={() => go(s.a?.url)}
                        onPressB={() => go(s.b?.url)}
                        onPressC={() => go(s.c?.url)}
                      />
                    )
                  default:
                    return <Cmp key={s.id} {...(s as any)} onPress={() => go((s as any).url)} />
                }
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  )
}
