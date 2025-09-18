import { useCallback, useState } from "react"
import type { LayoutChangeEvent } from "react-native"

export function useDeferredFooter() {
  const [footerVisible, setFooterVisible] = useState(false)
  const [listHeight, setListHeight] = useState(0)

  const revealFooter = useCallback(() => {
    setFooterVisible(true)
  }, [])

  const resetFooter = useCallback(() => {
    setFooterVisible(false)
  }, [])

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setListHeight(event.nativeEvent.layout.height || 0)
  }, [])

  const onContentSizeChange = useCallback(
    (_: number, height: number) => {
      if (listHeight && height <= listHeight + 1) {
        setFooterVisible(true)
      }
    },
    [listHeight],
  )

  return { footerVisible, revealFooter, resetFooter, onLayout, onContentSizeChange }
}
