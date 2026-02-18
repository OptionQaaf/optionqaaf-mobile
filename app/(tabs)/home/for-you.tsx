import { Screen } from "@/ui/layout/Screen"
import { Text, View } from "react-native"

export default function ForYouScreen() {
  return (
    <Screen bleedTop bleedBottom>
      <View className="flex-1 bg-white">
        <View className="items-center pt-20">
          <Text className="text-primary font-geist-semibold text-[18px]">FYP is being upgraded</Text>
          <Text className="mt-2 text-secondary">Pull to refresh later.</Text>
        </View>
      </View>
    </Screen>
  )
}
