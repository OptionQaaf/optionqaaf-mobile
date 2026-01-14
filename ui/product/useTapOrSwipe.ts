import { useEffect, useMemo, useRef } from "react"
import { Gesture } from "react-native-gesture-handler"
import { scheduleOnRN } from "react-native-worklets"

type Options = {
  onPress?: () => void
  maxDistance?: number
  maxDurationMs?: number
}

export function useTapOrSwipe({ onPress, maxDistance = 12, maxDurationMs = 260 }: Options) {
  const onPressRef = useRef(onPress)

  useEffect(() => {
    onPressRef.current = onPress
  }, [onPress])

  return useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(maxDistance)
        .maxDuration(maxDurationMs)
        .onEnd((_, success) => {
          if (!success) return
          const handler = onPressRef.current
          if (!handler) return
          scheduleOnRN(handler)
        }),
    [maxDistance, maxDurationMs],
  )
}
