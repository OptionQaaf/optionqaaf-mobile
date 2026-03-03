import { useMemo } from "react"
import { Gesture } from "react-native-gesture-handler"
import { scheduleOnRN } from "react-native-worklets"

type Options = {
  onPress?: () => void
  excludeRect?: {
    left: number
    right: number
    top: number
    bottom: number
  } | null
  maxDistance?: number
  maxDurationMs?: number
}

export function useTapOrSwipe({ onPress, excludeRect, maxDistance = 12, maxDurationMs = 260 }: Options) {
  return useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(maxDistance)
        .maxDuration(maxDurationMs)
        .onEnd((event, success) => {
          if (!success) return
          if (!onPress) return
          if (excludeRect) {
            const x = typeof event.x === "number" ? event.x : NaN
            const y = typeof event.y === "number" ? event.y : NaN
            if (
              Number.isFinite(x) &&
              Number.isFinite(y) &&
              x >= excludeRect.left &&
              x <= excludeRect.right &&
              y >= excludeRect.top &&
              y <= excludeRect.bottom
            ) {
              return
            }
          }
          scheduleOnRN(onPress)
        }),
    [maxDistance, maxDurationMs, onPress, excludeRect],
  )
}
