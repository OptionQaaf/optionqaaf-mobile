import { Screen } from "@/ui/layout/Screen"
import { H1, Text } from "@/ui/primitives/Typography"
import { Link } from "expo-router"
import { View } from "react-native"

export default function DevHome() {
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
      </View>
    </Screen>
  )
}
