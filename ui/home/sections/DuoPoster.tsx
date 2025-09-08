import { Image, Pressable, View } from "react-native"

type Item = { image?: { url: string }; url?: string }
type Props = { left?: Item; right?: Item; onPressLeft?: () => void; onPressRight?: () => void }

export function DuoPoster({ left, right, onPressLeft, onPressRight }: Props) {
  return (
    <View className="w-full flex-row">
      <Pressable onPress={onPressLeft} className="flex-1">
        {!!left?.image?.url && (
          <Image source={{ uri: left.image.url }} resizeMode="cover" className="h-[220px] w-full" />
        )}
      </Pressable>
      <Pressable onPress={onPressRight} className="flex-1">
        {!!right?.image?.url && (
          <Image source={{ uri: right.image.url }} resizeMode="cover" className="h-[220px] w-full" />
        )}
      </Pressable>
    </View>
  )
}
