// app/test/index.tsx
import { Link, router } from "expo-router"
import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"

export default function TestIndex() {
  const [handle, setHandle] = useState("")

  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Test Screens</Text>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Shop Ping</Text>
        <Link href="/test/ping" style={{ color: "#2563eb", fontSize: 16 }}>
          → /test/ping
        </Link>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Customer Account API</Text>
        <Link href="/test/customer-login" style={{ color: "#2563eb", fontSize: 16 }}>
          → Login flow (PKCE)
        </Link>
        <Link href="/test/customer-account" style={{ color: "#2563eb", fontSize: 16 }}>
          → Account data preview
        </Link>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Product & Cart (enter a valid product handle)</Text>
        <TextInput
          value={handle}
          onChangeText={setHandle}
          placeholder="e.g. black-denim-jacket"
          autoCapitalize="none"
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            padding: 12,
            borderRadius: 8,
          }}
        />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => handle && router.push(`/test/product/${handle}`)}
            style={{ backgroundColor: "#111827", padding: 12, borderRadius: 8 }}
          >
            <Text style={{ color: "white" }}>Open Product Test</Text>
          </Pressable>
          <Pressable
            onPress={() => handle && router.push(`/test/cart/${handle}`)}
            style={{ backgroundColor: "#111827", padding: 12, borderRadius: 8 }}
          >
            <Text style={{ color: "white" }}>Open Cart Test</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={{ opacity: 0.6 }}>Tip: start with /test/ping to confirm your Storefront token and version.</Text>
      </View>
    </View>
  )
}
