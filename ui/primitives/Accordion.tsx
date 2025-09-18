import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { MOTION } from "@/ui/motion/motion"
import { ChevronDown } from "lucide-react-native"
import React, { createContext, useContext, useMemo, useState } from "react"
import { Text, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

type Ctx = {
  multiple: boolean
  isOpen: (key: string) => boolean
  toggle: (key: string) => void
}

const AccordionCtx = createContext<Ctx | null>(null)

export type AccordionProps = {
  multiple?: boolean
  value?: string[] | string
  defaultValue?: string[] | string
  onValueChange?: (next: string[] | string) => void
  className?: string
  children: React.ReactNode
}

export function Accordion({
  multiple = false,
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: AccordionProps) {
  const controlled = value != null
  const initSet = () => {
    if (value != null) return new Set(Array.isArray(value) ? value : value ? [value] : [])
    if (defaultValue != null)
      return new Set(Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [])
    return new Set<string>()
  }
  const [internal, setInternal] = useState<Set<string>>(initSet)
  const openSet = controlled ? new Set(Array.isArray(value) ? value : value ? [value] : []) : internal

  const isOpen = (key: string) => openSet.has(key)
  const toggle = (key: string) => {
    const next = new Set(openSet)
    if (multiple) {
      next.has(key) ? next.delete(key) : next.add(key)
      if (controlled) onValueChange?.(Array.from(next))
      else setInternal(next)
    } else {
      const willOpen = !next.has(key)
      const result = new Set<string>()
      if (willOpen) result.add(key)
      if (controlled) onValueChange?.(willOpen ? key : "")
      else setInternal(result)
    }
  }

  const ctx = useMemo<Ctx>(() => ({ multiple, isOpen, toggle }), [multiple, controlled, value, internal])

  return (
    <AccordionCtx.Provider value={ctx}>
      <View className={className}>{children}</View>
    </AccordionCtx.Provider>
  )
}

export type AccordionItemProps = {
  value: string
  title?: string | React.ReactNode
  subtitle?: string
  right?: React.ReactNode
  disabled?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
  children?: React.ReactNode
  appearance?: "card" | "field" | "inline"
  keepMounted?: boolean
}

export function AccordionItem({
  value,
  title,
  subtitle,
  right,
  disabled,
  className,
  headerClassName,
  contentClassName,
  children,
  appearance = "card",
  keepMounted = false,
}: AccordionItemProps) {
  const ctx = useContext(AccordionCtx)
  if (!ctx) throw new Error("AccordionItem must be used within <Accordion>")
  const open = ctx.isOpen(value)

  // Chevron rotation
  const rotate = useSharedValue(open ? 180 : 0)
  const rStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }))
  React.useEffect(() => {
    rotate.value = withTiming(open ? 180 : 0, { duration: MOTION.dur.sm })
  }, [open])

  const wrapperClass =
    appearance === "inline"
      ? ""
      : appearance === "field"
        ? "rounded-xl border border-border bg-surface overflow-hidden"
        : "border border-border rounded-2xl bg-surface overflow-hidden"
  const headerBaseClass =
    appearance === "inline"
      ? "px-0 flex-row items-center justify-between"
      : appearance === "field"
        ? "px-4 h-12 flex-row items-center justify-between border-b border-border"
        : "px-4 py-3 flex-row items-center justify-between"

  return (
    <View className={[wrapperClass, className].filter(Boolean).join(" ")}>
      <PressableOverlay
        disabled={disabled}
        onPress={() => ctx.toggle(value)}
        className={[headerBaseClass, headerClassName].filter(Boolean).join(" ")}
      >
        <View className="flex-1 min-w-0">
          {typeof title === "string" ? (
            <Text className="text-primary text-[14px] font-geist-semibold" numberOfLines={1}>
              {title}
            </Text>
          ) : (
            (title ?? null)
          )}
          {subtitle ? (
            <Text className="text-secondary text-[12px]" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View className="flex-row items-center gap-2 pr-1">
          {right}
          <Animated.View style={rStyle}>
            <ChevronDown size={18} color="#0B0B0B" />
          </Animated.View>
        </View>
      </PressableOverlay>

      {open || keepMounted ? (
        <Animated.View
          entering={open ? MOTION.enter.fade : undefined}
          exiting={!open && !keepMounted ? MOTION.exit.fade : undefined}
          layout={MOTION.spring()}
          style={keepMounted && !open ? { height: 1, opacity: 0, overflow: "hidden" } : undefined}
          className={[
            appearance === "inline" ? "px-0 pb-3 pt-2" : appearance === "field" ? "px-4 pb-4 pt-3" : "px-4 pb-4",
            contentClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </Animated.View>
      ) : null}
      {appearance === "inline" ? <View className="h-px bg-border mb-2" /> : null}
    </View>
  )
}

Accordion.Item = AccordionItem as any
