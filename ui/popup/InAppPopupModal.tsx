import { PopupPayload } from "@/types/popup"
import { Button } from "@/ui/primitives/Button"
import { Image } from "expo-image"
import { Gift, Megaphone, Shield, Sparkles, Star, Tag, X, type LucideIcon } from "lucide-react-native"
import { Modal, Pressable, ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Props = {
  popup: PopupPayload
  visible: boolean
  onDismiss: () => void
  onCtaPress?: (cta: PopupPayload["cta"]) => void
}

const OVERLAY_COLOR = "rgba(15, 23, 42, 0.65)"
const INTERNAL_GAP = 8

export function InAppPopupModal({ popup, visible, onDismiss, onCtaPress }: Props) {
  const insets = useSafeAreaInsets()

  if (!popup) return null

  const handleCta = () => {
    if (popup.cta) {
      onCtaPress?.(popup.cta)
    }
  }

  const systemIconMap = {
    Sparkles,
    Megaphone,
    Gift,
    Tag,
    Star,
    Shield,
  } as const
  type SystemIconName = keyof typeof systemIconMap
  const iconName = popup.icon?.type === "system" ? (popup.icon.value as SystemIconName) : null
  const IconComponent: LucideIcon | null = iconName ? systemIconMap[iconName] : null
  const iconNode = popup.icon ? (
    popup.icon.type === "image" ? (
      <Image source={{ uri: popup.icon.value }} style={{ width: 96, height: 96, borderRadius: 0 }} contentFit="cover" />
    ) : IconComponent ? (
      <View
        style={{
          width: 96,
          height: 96,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#e2e8f0",
          borderRadius: "100%",
        }}
      >
        <IconComponent size={64} color="#64748b" />
      </View>
    ) : (
      <View
        style={{
          width: 96,
          height: 96,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#e2e8f0",
        }}
      >
        <Text className="text-2xl" numberOfLines={1}>
          {popup.icon.value}
        </Text>
      </View>
    )
  ) : null

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={onDismiss}
          style={{ flex: 1, backgroundColor: OVERLAY_COLOR }}
          accessibilityLabel="Dismiss popup"
        />
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            top: Math.max(insets.top, 16),
            bottom: Math.max(insets.bottom, 16),
            justifyContent: "center",
            alignItems: "center",
          }}
          pointerEvents="box-none"
        >
          <View
            style={{
              alignSelf: "stretch",
              backgroundColor: "#ffffff",
              borderRadius: 28,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              paddingBottom: INTERNAL_GAP * 2,
              paddingTop: INTERNAL_GAP,
              paddingHorizontal: INTERNAL_GAP,
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 10,
              maxHeight: "90%",
            }}
          >
            <Pressable
              onPress={onDismiss}
              accessibilityLabel="Close popup"
              style={{
                position: "absolute",
                right: 12,
                top: 12,
                height: 40,
                width: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                backgroundColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                elevation: 5,
              }}
            >
              <X size={18} color="#0f172a" strokeWidth={1.5} />
            </Pressable>
            <ScrollView
              contentContainerStyle={{ gap: INTERNAL_GAP, paddingTop: 24, paddingBottom: INTERNAL_GAP }}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: "100%" }}
            >
              {iconNode ? <View className="items-center">{iconNode}</View> : null}
              <Text className="text-center text-lg font-geist-semibold text-[#0f172a]">{popup.title}</Text>
              <Text className="text-center text-[15px] text-[#475569] leading-[20px]">{popup.body}</Text>
            </ScrollView>
            {popup.cta ? (
              <Button
                size="lg"
                fullWidth
                onPress={handleCta}
                className="mt-3"
                accessibilityLabel={`CTA: ${popup.cta.label}`}
              >
                {popup.cta.label}
              </Button>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}
