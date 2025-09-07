import { Star, StarHalf } from "lucide-react-native"
import { View } from "react-native"

export function RatingStars({
  rating = 0,
  size = 14,
  className,
}: {
  rating?: number
  size?: number
  className?: string
}) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)

  return (
    <View className={className + " flex-row items-center gap-1"}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={size} fill="black" color="black" />
      ))}
      {half && <StarHalf size={size} color="black" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={size} color="#D4D4D8" />
      ))}
    </View>
  )
}
