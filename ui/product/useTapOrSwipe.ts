import { useMemo } from "react"
import { Gesture } from "react-native-gesture-handler"
import { scheduleOnRN } from "react-native-worklets"

type Options = {
  onPress?: () => void
  maxDistance?: number
  maxDurationMs?: number
}

export function useTapOrSwipe({ onPress, maxDistance = 12, maxDurationMs = 260 }: Options) {
  return useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(maxDistance)
        .maxDuration(maxDurationMs)
        .onEnd((_, success) => {
          if (!success) return
          if (!onPress) return
          scheduleOnRN(onPress)
        }),
    [maxDistance, maxDurationMs, onPress],
  )
}
