import { ImageBackground, Pressable, Text as RNText, View } from "react-native"

// Lazy import so it doesn't explode if not installed; we fall back to a flat tint.
let LinearGradient: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LinearGradient = require("expo-linear-gradient").LinearGradient
} catch {}

type Props = {
  title?: string
  subtitle?: string
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
  subtitle,
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
  const aClass =
    align === "center"
      ? "items-center text-center"
      : align === "right"
        ? "items-end text-right"
        : "items-start text-left"

  // palette
  const isDark = theme === "dark"
  const isBrand = theme === "brand"
  const fg = isDark ? "#FFFFFF" : "#0B0B0B"
  const subFg = isDark ? "rgba(255,255,255,0.85)" : "rgba(11,11,11,0.85)"
  const brand = "#8E1A26" // OptionQaaf deep red; tweak if you have a token

  // responsive headline sizing
  const titleLen = (title ?? "").length
  const titleSize = titleLen <= 10 ? 56 : titleLen <= 16 ? 48 : titleLen <= 24 ? 42 : 36
  const titleLine = Math.round(titleSize * 1.02)

  const Title = () =>
    title ? (
      <RNText
        className="font-extrabold"
        style={{
          color: fg,
          fontSize: titleSize,
          lineHeight: titleLine,
          letterSpacing: 0.5,
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

  const Subtitle = () =>
    subtitle ? (
      <RNText
        style={{
          color: subFg,
          fontSize: 16,
          letterSpacing: 0.6,
        }}
      >
        {subtitle}
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
      <ImageBackground
        source={image?.url ? { uri: image.url } : undefined}
        resizeMode="cover"
        style={{ height, width: "100%" }}
      >
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
          <Subtitle />
          <CTA />

          {/* brand stripe (subtle accent) */}
          {isBrand ? <View style={{ height: 3, alignSelf: "stretch", backgroundColor: brand, marginTop: 10 }} /> : null}
        </View>
      </ImageBackground>
    </Pressable>
  )
}
