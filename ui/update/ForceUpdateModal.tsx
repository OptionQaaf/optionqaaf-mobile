import { Button } from "@/ui/primitives/Button"
import { Image } from "expo-image"
import { Linking, Modal, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type Props = {
  visible: boolean
  storeUrl: string | null
}

export function ForceUpdateModal({ visible, storeUrl }: Props) {
  const insets = useSafeAreaInsets()

  const handleUpdate = () => {
    if (!storeUrl) return
    Linking.openURL(storeUrl).catch(() => {})
  }

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15, 23, 42, 0.75)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            alignSelf: "stretch",
            backgroundColor: "#ffffff",
            borderRadius: 28,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            padding: 24,
            gap: 16,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <Image
            source={require("@/assets/images/white-icon.png")}
            style={{ width: 80, height: 80, borderRadius: 18, alignSelf: "center" }}
            contentFit="contain"
          />
          <Text className="text-center text-lg font-geist-semibold text-[#0f172a]">Update Required</Text>
          <Text className="text-center text-[15px] text-[#475569] leading-[22px]">
            A newer version of OptionQaaf is available. Please update to continue using the app.
          </Text>
          <Button size="lg" fullWidth onPress={handleUpdate}>
            Update Now
          </Button>
        </View>
      </View>
    </Modal>
  )
}
