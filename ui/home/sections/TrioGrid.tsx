import { Image, Pressable, View } from "react-native"

type Cell = { image?: { url: string }; url?: string }
type Props = { a?: Cell; b?: Cell; c?: Cell; onPressA?: () => void; onPressB?: () => void; onPressC?: () => void }

export function TrioGrid({ a, b, c, onPressA, onPressB, onPressC }: Props) {
  return (
    <View className="w-full">
      <View className="flex-row">
        <Pressable onPress={onPressA} className="flex-1">
          {!!a?.image?.url && <Image source={{ uri: a.image.url }} resizeMode="cover" className="h-[180px] w-full" />}
        </Pressable>
        <Pressable onPress={onPressB} className="flex-1">
          {!!b?.image?.url && <Image source={{ uri: b.image.url }} resizeMode="cover" className="h-[180px] w-full" />}
        </Pressable>
        <Pressable onPress={onPressC} className="flex-1">
          {!!c?.image?.url && <Image source={{ uri: c.image.url }} resizeMode="cover" className="h-[180px] w-full" />}
        </Pressable>
      </View>
    </View>
  )
}
