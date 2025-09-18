import { a11yAlert } from "@/ui/a11y/a11y"
import { hapticOnce, haptics } from "@/ui/feedback/useHaptics"
import { MOTION } from "@/ui/motion/motion"
import { Pressable, Text, View } from "react-native"
import Animated from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import { create } from "zustand"

type Toast = {
  id: number
  title: string
  type?: "info" | "success" | "danger"
  duration?: number
}

type Store = {
  toasts: Toast[]
  show: (t: Omit<Toast, "id">) => void
  dismiss: (id: number) => void
}

let idSeq = 1

export const useToast = create<Store>((set) => ({
  toasts: [],
  show: (t) => {
    const id = idSeq++
    const toast: Toast = { id, duration: 2500, ...t }
    set((s) => ({ toasts: [...s.toasts, toast] }))

    if (t.type === "success") hapticOnce(haptics.success)
    else if (t.type === "danger") hapticOnce(haptics.error)
    else hapticOnce(haptics.impact.light)

    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    }, toast.duration)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export function ToastHost() {
  const { toasts, dismiss } = useToast()

  return (
    <SafeAreaView edges={["top"]} pointerEvents="box-none" className="absolute top-0 left-0 right-0 z-50">
      <View className="pt-2">
        {toasts.map((t) => (
          <Animated.View
            key={t.id}
            entering={MOTION.enter.fadeDown}
            exiting={MOTION.exit.fadeUp}
            layout={MOTION.spring()}
            className="mx-4 mt-2"
          >
            <Pressable onPress={() => dismiss(t.id)} className="active:opacity-90">
              <View
                {...a11yAlert()}
                className={[
                  "rounded-2xl px-4 py-3 border shadow-lg",
                  t.type === "success"
                    ? "bg-success border-success"
                    : t.type === "danger"
                      ? "bg-danger border-danger"
                      : "bg-surface border-border",
                ].join(" ")}
                style={{ elevation: 6 }}
              >
                <Text className={t.type === "success" || t.type === "danger" ? "text-white" : "text-primary"}>
                  {t.title}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </SafeAreaView>
  )
}
