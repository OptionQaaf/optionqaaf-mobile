import { Screen } from "@/ui/layout/Screen"
import { Text, View } from "react-native"

export default function ForYouScreen() {
  return (
    <Screen bleedTop bleedBottom>
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-2xl font-bold mb-4">For You</Text>
        <Text className="text-center text-gray-600">
          This section is coming soon! We're working hard to bring you personalized content and recommendations. Stay
          tuned for updates!
        </Text>
      </View>
    </Screen>
  )
}
