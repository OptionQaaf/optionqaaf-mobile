import { ImageBackground, Pressable, Text, useWindowDimensions, View } from "react-native"

// Lazy import gradient to avoid hard dependency
let LinearGradient: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LinearGradient = require("expo-linear-gradient").LinearGradient
} catch {}

type Props = {
  image: string
  brand?: string
  title: string
  price?: number
  currency?: string
  onPress?: () => void
  width?: number
  ratio?: number
  rounded?: "none" | "xl" | "2xl" | "3xl"
  showPrice?: boolean
}

export function HomeProductTile({
  image,
  brand,
  title,
  price,
  currency = "USD",
  onPress,
  width,
  ratio = 1,
  rounded = "none",
  showPrice = false,
}: Props) {
  const { width: winW } = useWindowDimensions()
  const w = width ?? Math.round(winW * 0.44)
  const radius = rounded === "none" ? 0 : rounded === "3xl" ? 24 : rounded === "2xl" ? 18 : 12
  // Responsive overlay sizes relative to card width
  const titleSize = Math.round(Math.min(22, Math.max(16, w * 0.12)))
  const line = Math.round(titleSize * 1.05)
  const brandSize = 11

  const PricePill = () =>
    showPrice && typeof price === "number" ? (
      <View
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          backgroundColor: "rgba(0,0,0,0.6)",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 12 }}>
          {new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price)}
        </Text>
      </View>
    ) : null

  return (
    <Pressable onPress={onPress} style={{ width: w }}>
      <View style={{ borderRadius: radius, overflow: "hidden" }}>
        <ImageBackground source={{ uri: image }} resizeMode="cover" style={{ aspectRatio: ratio }}>
          {/* scrim */}
          {LinearGradient ? (
            <LinearGradient
              colors={["rgba(0,0,0,0.02)", "rgba(0,0,0,0.55)"]}
              start={{ x: 0.5, y: 0.15 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            />
          ) : null}

          {/* overlay content */}
          <View style={{ flex: 1, justifyContent: "flex-end", padding: 12 }}>
            {brand ? (
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: brandSize, marginBottom: 2 }} numberOfLines={1}>
                {brand}
              </Text>
            ) : null}
            <Text
              style={{ color: "#FFF", fontWeight: "800", fontSize: titleSize, lineHeight: line, maxWidth: "92%" }}
              numberOfLines={2}
            >
              {title}
            </Text>
          </View>

          <PricePill />
        </ImageBackground>
      </View>
    </Pressable>
  )
}
