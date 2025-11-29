import { ReactNode } from "react"
import { Text, View } from "react-native"

import { Container } from "@/ui/layout/Container"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { Screen } from "@/ui/layout/Screen"
import { MarkdownRenderer } from "@/ui/markdown/MarkdownRenderer"
import { MenuBar } from "@/ui/nav/MenuBar"

type Props = {
  title: string
  markdownSource: number
  headerSlot?: ReactNode
}

export function PolicyScreenTemplate({ title, markdownSource, headerSlot }: Props) {
  return (
    <Screen bleedBottom>
      <MenuBar back />
      <PageScrollView contentContainerClassName="bg-white">
        <Container className="py-6 gap-4">
          <View className="gap-2">
            <Text className="text-[28px] font-geist-bold text-primary">{title}</Text>
            {headerSlot}
          </View>

          <MarkdownRenderer source={markdownSource} className="pb-4" />
        </Container>
      </PageScrollView>
    </Screen>
  )
}
