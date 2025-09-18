import { ReactNode } from "react"
import { View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

type Props = {
  children: ReactNode
  bleedTop?: boolean
  bleedBottom?: boolean
  bleedHorizontal?: boolean
}

export function Screen({ children, bleedTop, bleedBottom, bleedHorizontal }: Props) {
  const edges: Array<"top" | "bottom" | "left" | "right"> = []
  if (!bleedTop) edges.push("top")
  if (!bleedBottom) edges.push("bottom")
  if (!bleedHorizontal) {
    edges.push("left")
    edges.push("right")
  }

  return (
    <SafeAreaView edges={edges} className="flex-1 bg-base">
      <View className="flex-1 w-full">{children}</View>
    </SafeAreaView>
  )
}
