import { AppFooter, type AppFooterProps } from "@/ui/layout/AppFooter"
import { useFloatingDockScaleContext } from "@/ui/nav/FloatingDockContext"
import { cn } from "@/ui/utils/cva"
import { forwardRef, useCallback, useEffect, useRef, type ComponentType, type ReactNode } from "react"
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewProps } from "react-native"
import { ScrollView, View } from "react-native"
import { defaultKeyboardShouldPersistTaps, verticalScrollProps } from "./scrollDefaults"

type FooterComponent = ComponentType<AppFooterProps>

type Props = ScrollViewProps & {
  children: ReactNode
  contentContainerClassName?: string
  FooterComponent?: FooterComponent
  footerClassName?: string
  footerProps?: Partial<AppFooterProps>
  isFooterHidden?: boolean
  floatingDockScaleOnScroll?: number
}

const SCROLL_DIRECTION_THRESHOLD = 6

export const PageScrollView = forwardRef<ScrollView, Props>(function PageScrollView(
  {
    children,
    contentContainerStyle,
    contentContainerClassName,
    keyboardShouldPersistTaps,
    FooterComponent = AppFooter,
    footerClassName,
    footerProps,
    isFooterHidden = false,
    floatingDockScaleOnScroll,
    onScroll,
    scrollEventThrottle,
    ...rest
  },
  ref,
) {
  const scaleContext = useFloatingDockScaleContext()
  const scrollDirection = useRef<"up" | "down">("up")
  const lastOffset = useRef(0)
  const downScale = Math.min(Math.max(floatingDockScaleOnScroll ?? 0.8, 0.3), 1)
  const setDockScale = scaleContext?.setScale
  const scheduledFrame = useRef<number | null>(null)

  const scheduleScaleUpdate = useCallback(
    (value: number) => {
      if (scheduledFrame.current !== null) {
        cancelAnimationFrame(scheduledFrame.current)
      }
      scheduledFrame.current = requestAnimationFrame(() => {
        setDockScale?.(value)
        scheduledFrame.current = null
      })
    },
    [setDockScale],
  )

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y
      const delta = offset - lastOffset.current
      lastOffset.current = offset
      if (delta > SCROLL_DIRECTION_THRESHOLD && scrollDirection.current !== "down" && offset > 0) {
        scrollDirection.current = "down"
        scheduleScaleUpdate(1)
      } else if (delta < -SCROLL_DIRECTION_THRESHOLD && scrollDirection.current !== "up") {
        scrollDirection.current = "up"
        scheduleScaleUpdate(downScale)
      }
      onScroll?.(event)
    },
    [downScale, onScroll, scheduleScaleUpdate],
  )

  useEffect(() => {
    if (scrollDirection.current === "up") {
      scheduleScaleUpdate(downScale)
    }
  }, [downScale, scheduleScaleUpdate])

  useEffect(() => {
    return () => {
      if (scheduledFrame.current !== null) {
        cancelAnimationFrame(scheduledFrame.current)
        scheduledFrame.current = null
      }
    }
  }, [])

  return (
    <ScrollView
      ref={ref}
      {...verticalScrollProps}
      {...rest}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? defaultKeyboardShouldPersistTaps}
      contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
      contentContainerClassName={cn(contentContainerClassName)}
      showsVerticalScrollIndicator={rest.showsVerticalScrollIndicator ?? false}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle ?? 16}
    >
      <View className="flex-1">{children}</View>
      {!isFooterHidden && <FooterComponent className={footerClassName} {...footerProps} />}
    </ScrollView>
  )
})
