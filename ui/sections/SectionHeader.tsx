import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Text, View } from "react-native"

export function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-primary font-geist-semibold text-[18px]">{title}</Text>
      {onSeeAll && (
        <PressableOverlay onPress={onSeeAll} className="px-2 py-1 rounded-md">
          <Text className="text-primary underline">See all</Text>
        </PressableOverlay>
      )}
    </View>
  )
}
