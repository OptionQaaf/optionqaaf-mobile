import { memo, useMemo } from "react"
import { Text, View } from "react-native"

type Word = {
  text: string
  weight?: number
}

type Props = {
  title?: string
  words?: Word[]
}

const weightToSize = (weight?: number, index?: number) => {
  if (typeof weight !== "number" || Number.isNaN(weight)) {
    if (typeof index === "number") {
      const tier = index % 5
      return [24, 22, 20, 18, 16][tier]
    }
    return 20
  }
  if (weight >= 80) return 30
  if (weight >= 60) return 26
  if (weight >= 40) return 23
  if (weight >= 20) return 20
  return 17
}

export const BrandCloud = memo(function BrandCloud({ title, words = [] }: Props) {
  const display = useMemo(() => words.filter((word) => word?.text?.trim()).slice(0, 60), [words])

  if (display.length === 0) return null

  return (
    <View className="w-full px-4 py-10 bg-white">
      {title ? <Text className="text-xs uppercase tracking-[4px] text-neutral-500 mb-4">{title}</Text> : null}
      <View className="flex-row flex-wrap justify-center">
        {display.map((word, index) => {
          const size = weightToSize(word.weight, index)
          return (
            <View key={`${word.text}-${index}`} className="px-2 py-2">
              <Text
                className="font-semibold text-neutral-500"
                style={{ fontSize: size, letterSpacing: 1.2 }}
                numberOfLines={1}
              >
                {word.text}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
})
