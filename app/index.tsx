// app/index.tsx
import { Link } from "expo-router"
import { Text, View } from "react-native"
import "../assets/css/main.css"

export default function Home() {
  return (
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>OptionQaaf — Dev Sandbox</Text>
      <Link href="/test" style={{ fontSize: 16, color: "#2563eb" }}>
        Go to Test Screens →
      </Link>
      <Link href="/(dev)" className="text-black underline">
        Open Development
      </Link>
    </View>
  )
}
