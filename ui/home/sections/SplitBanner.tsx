import { Pressable, Text as RNText, View, useWindowDimensions, StyleSheet, PixelRatio } from "react-native"
import { Image } from "expo-image"
import { optimizeImageUrl, DEFAULT_PLACEHOLDER } from "@/lib/images/optimize"

// Lazy import so it doesn't explode if not installed; we fall back to a flat tint.
let LinearGradient: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LinearGradient = require("expo-linear-gradient").LinearGradient
} catch {}

type Props = {
  title?: string
  eyebrow?: string
  ctaLabel?: string
  image?: { url: string }
  theme?: "light" | "dark" | "brand" | (string & {})
  align?: "left" | "center" | "right"
  onPress?: () => void
  height?: number
  /** 0..1 scrim strength */
  tint?: number
  /** force uppercase title */
  uppercaseTitle?: boolean
}

export function SplitBanner({
  title,
  eyebrow,
  ctaLabel,
  image,
  theme = "light",
  align = "left",
  onPress,
  height = 320,
  tint = 0.45,
  uppercaseTitle = true,
}: Props) {
  const { width } = useWindowDimensions()
  const aClass =
    align === "center"
      ? "items-center text-center"
      : align === "right"
        ? "items-end text-right"
        : "items-start text-left"

  // palette
  const isDark = theme === "dark"
  const isBrand = theme === "brand"
  const fg = "#FFFFFF"
  const subFg = !isDark ? "rgba(255,255,255,0.85)" : "rgba(11,11,11,0.85)"
  const brand = "#8E1A26"

  // responsive headline sizing (by width, clamped)
  const titleSize = Math.round(Math.min(84, Math.max(38, width * 0.14)))
  const titleLine = Math.round(titleSize * 1.05)

  const Title = () =>
    title ? (
      <RNText
        className="font-extrabold"
        style={{
          color: fg,
          fontSize: titleSize,
          lineHeight: titleLine,
          letterSpacing: 0.5,
          textTransform: uppercaseTitle ? "uppercase" : "none",
        }}
      >
        {title}
      </RNText>
    ) : null

  const Eyebrow = () =>
    eyebrow ? (
      <RNText
        style={{
          color: isBrand ? brand : subFg,
          fontSize: 13,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </RNText>
    ) : null

  const CTA = () =>
    ctaLabel ? (
      <View className="flex-row items-center" style={{ marginTop: 12 }}>
        <RNText
          className="font-geist-medium"
          style={{
            color: isBrand ? brand : fg,
            fontSize: 16,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {ctaLabel}
        </RNText>
        <RNText style={{ color: isBrand ? brand : fg, fontSize: 18, marginLeft: 8 }}>→</RNText>
      </View>
    ) : null

  // scrim stops: darker at bottom, subtle at top
  const gradientColors = isDark
    ? ["rgba(0,0,0,0.05)", `rgba(0,0,0,${tint})`]
    : ["rgba(0,0,0,0.02)", `rgba(0,0,0,${tint * 0.75})`]

  return (
    <Pressable onPress={onPress}>
      <View style={{ height, width: "100%" }}>
        {image?.url ? (
          <Image
            source={{
              uri:
                optimizeImageUrl(image.url, {
                  width: Math.round(width),
                  height,
                  format: "webp",
                  dpr: Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1)),
                }) || image.url,
            }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={0}
            cachePolicy="disk"
            priority="high"
            placeholder={DEFAULT_PLACEHOLDER}
          />
        ) : null}
        {/* scrim */}
        {LinearGradient ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0.5, y: 0.1 }}
            end={{ x: 0.5, y: 1 }}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
        ) : (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: height * 0.55,
            }}
          />
        )}

        {/* content */}
        <View className={`flex-1 justify-end p-4 ${aClass}`}>
          <Eyebrow />
          <Title />
          <CTA />

          {/* brand stripe (subtle accent) */}
          {isBrand ? <View style={{ height: 3, alignSelf: "stretch", backgroundColor: brand, marginTop: 10 }} /> : null}
        </View>
      </View>
    </Pressable>
  )
}
