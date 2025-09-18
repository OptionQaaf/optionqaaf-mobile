import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { useLocalSearchParams } from "expo-router"
import { WebView } from "react-native-webview"
import { View } from "react-native"

export default function CheckoutScreen() {
  const { url } = useLocalSearchParams<{ url: string }>()
  const u = typeof url === "string" ? url : ""
  return (
    <Screen bleedBottom>
      <MenuBar back />
      <View style={{ flex: 1 }}>
        <WebView source={{ uri: u }} style={{ flex: 1 }} />
      </View>
    </Screen>
  )
}
