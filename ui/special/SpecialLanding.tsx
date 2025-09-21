import { useCollectionsSummary } from "@/features/collections/api"
import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { Image } from "expo-image"
import { router } from "expo-router"
import { useMemo } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

type Props = {
  variant?: "Men" | "Women" | string
  collectionHandles?: string[]
}

let LinearGradient: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LinearGradient = require("expo-linear-gradient").LinearGradient
} catch {}

type Palette = {
  surface: string
  stroke: string
  shadow: string
  overlayTop: string
  overlayBottom: string
  fallbackOverlay: string
  copy: string
  copyMuted: string
  accent: string
  caption: string
  chipBg: string
  chipFg: string
  blurTint: "light" | "dark"
  blurBg: string
  motifPrimary: string
  motifSecondary: string
}

type EditorialTheme = {
  gradient: [string, string]
  swatches: string[]
  subtitle: (title: string) => string
  body: (title: string) => string
  ctaPrefix: string
}

export function SpecialLanding({ variant = "Men", collectionHandles = [] }: Props) {
  const { width, height } = useWindowDimensions()
  const normalized = (variant || "").toLowerCase()
  const isWomen = normalized.includes("women")
  const insets = useSafeAreaInsets()

  const { palette, hero, cardThemes, chips, signature, description } = useMemo(() => {
    if (isWomen) {
      const palette: Palette = {
        surface: "#f6f0f5",
        stroke: "rgba(255,255,255,0.42)",
        shadow: "rgba(121, 91, 107, 0.24)",
        overlayTop: "rgba(16, 10, 19, 0.08)",
        overlayBottom: "rgba(16, 10, 19, 0.65)",
        fallbackOverlay: "rgba(16, 10, 19, 0.52)",
        copy: "#ffffff",
        copyMuted: "rgba(255,255,255,0.78)",
        accent: "#b03a7d",
        caption: "#4c1d3b",
        chipBg: "rgba(76, 29, 59, 0.14)",
        chipFg: "#2f0f23",
        blurTint: "light",
        blurBg: "rgba(255,255,255,0.55)",
        motifPrimary: "rgba(176, 58, 125, 0.32)",
        motifSecondary: "rgba(224, 174, 206, 0.42)",
      }
      const hero = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=2400"
      const cardThemes: EditorialTheme[] = [
        {
          gradient: ["rgba(176, 97, 139, 0.72)", "rgba(246, 240, 245, 0.48)"],
          swatches: ["#4a1d30", "#c07ea9", "#f6e8f2"],
          subtitle: (title) => `Runway capsule • ${title}`,
          body: (title) =>
            `${title} arrives with runway-level sheen and hand-finished embellishment, curated for nocturnal gallery circuits.`,
          ctaPrefix: "Discover",
        },
        {
          gradient: ["rgba(209, 102, 120, 0.68)", "rgba(62, 22, 66, 0.6)"],
          swatches: ["#3d1232", "#de8297", "#f7c7da"],
          subtitle: (title) => `Chromatic tailoring • ${title}`,
          body: (title) =>
            `${title} layers sculptural tailoring with colour-theory accents, a favourite among the OptionQaaf editorial board.`,
          ctaPrefix: "Shop",
        },
        {
          gradient: ["rgba(118, 78, 60, 0.7)", "rgba(246, 240, 245, 0.55)"],
          swatches: ["#3d1f15", "#a46f58", "#f0d9ce"],
          subtitle: (title) => `Evening textures • ${title}`,
          body: (title) =>
            `${title} focuses on featherweight jacquards and velvet architecture – built for premieres and award season afterglow.`,
          ctaPrefix: "View",
        },
      ]
      const chips = ["Award citations", "Gallery capsules", "Runway limited"]
      const signature = "For The Avant Femme Collector"
      const description =
        "An edit of OptionQaaf designers earning editorial shortlist buzz — luminous gowns, precision tailoring, and art-led silhouettes."
      return { palette, hero, cardThemes, chips, signature, description }
    }

    const palette: Palette = {
      surface: "#0a0b12",
      stroke: "rgba(208,165,98,0.28)",
      shadow: "rgba(3, 4, 7, 0.68)",
      overlayTop: "rgba(3, 4, 7, 0.15)",
      overlayBottom: "rgba(3, 4, 7, 0.78)",
      fallbackOverlay: "rgba(3, 4, 7, 0.55)",
      copy: "#f6f4ef",
      copyMuted: "rgba(246,244,239,0.74)",
      accent: "#d0a562",
      caption: "#d0a562",
      chipBg: "rgba(208,165,98,0.18)",
      chipFg: "#f6f4ef",
      blurTint: "dark",
      blurBg: "rgba(10, 11, 18, 0.6)",
      motifPrimary: "rgba(62, 52, 43, 0.62)",
      motifSecondary: "rgba(23, 25, 35, 0.8)",
    }
    const hero = "https://images.unsplash.com/photo-1475180098004-ca77a66827be?q=80&w=2400"
    const cardThemes: EditorialTheme[] = [
      {
        gradient: ["rgba(32, 36, 48, 0.82)", "rgba(12, 12, 18, 0.65)"],
        swatches: ["#10131d", "#3f485a", "#d0a562"],
        subtitle: (title) => `Night shift tailoring • ${title}`,
        body: (title) =>
          `${title} is built with modular suiting and reflective trims engineered for skyline movement and late service calls.`,
        ctaPrefix: "Explore",
      },
      {
        gradient: ["rgba(26, 28, 40, 0.78)", "rgba(9, 10, 16, 0.7)"],
        swatches: ["#0d1018", "#40465a", "#c2a76a"],
        subtitle: (title) => `Studio layering • ${title}`,
        body: (title) =>
          `${title} layers mesh bombers, adaptive cargos, and tonal armour plates for sets that run past midnight.`,
        ctaPrefix: "View",
      },
      {
        gradient: ["rgba(32, 28, 24, 0.82)", "rgba(10, 11, 18, 0.7)"],
        swatches: ["#16171e", "#3b2f24", "#d5b16a"],
        subtitle: (title) => `Architectural essentials • ${title}`,
        body: (title) =>
          `${title} curates pleated coats, structural denim, and gallery knitwear to anchor the OptionQaaf menswear ballot.`,
        ctaPrefix: "Shop",
      },
    ]
    const chips = ["Editorial shortlists", "Architected streetwear", "Modular tailoring"]
    const signature = "For The Modern Vanguard"
    const description =
      "OptionQaaf's menswear jury picks: directional tailoring, award-nominated street outerwear, and night-ready finishing details."
    return { palette, hero, cardThemes, chips, signature, description }
  }, [isWomen])

  const defaultHandles = useMemo(
    () => (isWomen ? ["athena-lulu", "abmy", "anniehall-1"] : ["alt", "awt", "be"]),
    [isWomen],
  )

  const resolvedHandles = useMemo(() => {
    const provided = (collectionHandles ?? []).filter(Boolean)
    if (provided.length > 0) return provided
    return defaultHandles
  }, [collectionHandles, defaultHandles])

  const { data: summaryCollections = [] } = useCollectionsSummary(resolvedHandles, cardThemes.length)

  const editorialCollections = useMemo(() => {
    if (!resolvedHandles.length) return []
    const toDisplay = resolvedHandles.slice(0, cardThemes.length)

    const titleFromHandle = (handle: string) =>
      handle
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")

    return toDisplay.map((handle, idx) => {
      const summary = summaryCollections.find((item) => item?.handle === handle)
      const title = summary?.title || titleFromHandle(handle)
      const theme = cardThemes[idx % cardThemes.length]
      return {
        handle,
        title,
        image: summary?.image,
        gradient: theme.gradient,
        swatches: theme.swatches,
        subtitle: theme.subtitle(title),
        description: theme.body(title),
        cta: `${theme.ctaPrefix} ${title}`,
      }
    })
  }, [resolvedHandles, cardThemes, summaryCollections])

  const heroHeight = Math.round(Math.min(520, Math.max(360, width * 0.88)))
  const blurCardWidth = Math.min(width * 0.6, 260)
  const collectionWidth = Math.min(width * 0.62, 240)
  const transitionGradient = isWomen
    ? ["rgba(246,240,245,1)", "rgba(246,240,245,0.45)", "rgba(255,255,255,0)"]
    : ["rgba(10,11,18,1)", "rgba(10,11,18,0.5)", "rgba(255,255,255,0)"]
  const heroTopPadding = 64 + insets.top

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: palette.surface }}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, minHeight: height + insets.bottom }}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={{ flex: 1, backgroundColor: palette.surface }}>
          <View
            className="overflow-hidden"
            style={{
              backgroundColor: palette.surface,
            }}
          >
            <View className="relative" style={{ height: heroHeight }}>
              <Image
                source={{
                  uri:
                    optimizeImageUrl(hero, {
                      width: Math.round(width),
                      height: heroHeight,
                      format: "webp",
                    }) || hero,
                }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={200}
                cachePolicy="disk"
                placeholder={DEFAULT_PLACEHOLDER}
              />

              {LinearGradient ? (
                <LinearGradient
                  colors={[palette.overlayTop, palette.overlayBottom]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.fallbackOverlay }]} />
              )}

              <View
                style={{
                  position: "absolute",
                  width: heroHeight * 0.95,
                  height: heroHeight * 0.95,
                  borderRadius: heroHeight,
                  backgroundColor: palette.motifPrimary,
                  top: -heroHeight * 0.45,
                  right: -heroHeight * 0.3,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: heroHeight * 0.58,
                  height: heroHeight * 0.58,
                  borderRadius: heroHeight,
                  backgroundColor: palette.motifSecondary,
                  bottom: -heroHeight * 0.32,
                  left: -heroHeight * 0.18,
                }}
              />

              <View
                style={[
                  styles.heroContent,
                  {
                    paddingTop: heroTopPadding,
                    paddingBottom: blurCardWidth > 220 ? 32 : 58,
                  },
                ]}
              >
                <View>
                  <Text style={[styles.eyebrow, { color: palette.copyMuted }]}>
                    Edition {isWomen ? "No. 02" : "No. 01"}
                  </Text>
                  <Text style={[styles.title, { color: palette.copy }]}>
                    {isWomen ? "Luminous Reverie" : "Vanguard Geometry"}
                  </Text>
                </View>
                <View style={styles.heroFooter}>
                  <Text style={[styles.signature, { color: palette.copy }]}>{signature}</Text>
                  <View style={[styles.rule, { backgroundColor: palette.accent }]} />
                </View>
              </View>

              {/* <BlurView
                intensity={75}
                tint={palette.blurTint}
                style={[
                  styles.blurCard,
                  {
                    width: blurCardWidth,
                    backgroundColor: palette.blurBg,
                    borderColor: palette.stroke,
                  },
                ]}
              >
                <Text style={[styles.blurTitle, { color: palette.caption }]}>Season 24/25</Text>
                <Text style={[styles.blurCopy, { color: palette.caption }]}>{description}</Text>
                <View style={styles.chipRow}>
                  {chips.map((chip) => (
                    <View key={chip} style={[styles.chip, { backgroundColor: palette.chipBg }]}>
                      <Text style={[styles.chipText, { color: palette.chipFg }]}>{chip}</Text>
                    </View>
                  ))}
                </View>
              </BlurView> */}
            </View>
          </View>

          {chips.length > 0 && (
            <View style={styles.heroChipRow}>
              {chips.map((chip) => (
                <View key={chip} style={[styles.heroChip, { backgroundColor: palette.chipBg }]}>
                  <Text style={[styles.heroChipText, { color: palette.chipFg }]}>{chip}</Text>
                </View>
              ))}
            </View>
          )}

          {editorialCollections.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: palette.accent }]} />
                <Text style={[styles.sectionLabel, { color: palette.caption }]}>Editorial Capsules</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToAlignment="center"
                snapToInterval={collectionWidth + 16}
                contentContainerStyle={{
                  paddingLeft: 28,
                  paddingRight: 24,
                  paddingBottom: 12,
                  gap: 16,
                }}
              >
                {editorialCollections.map((collection, idx) => (
                  <Pressable
                    key={collection.handle}
                    onPress={() => router.push(`/collections/${collection.handle}` as any)}
                    style={({ pressed }) => [
                      {
                        width: collectionWidth,
                        marginRight: idx === editorialCollections.length - 1 ? 0 : 16,
                      },
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <View style={[styles.collectionCard, { backgroundColor: palette.blurBg }]}>
                      {collection.image ? (
                        <Image
                          source={{
                            uri:
                              optimizeImageUrl(collection.image, {
                                width: Math.round(collectionWidth * 1.5),
                                height: 360,
                                format: "webp",
                              }) || collection.image,
                          }}
                          style={StyleSheet.absoluteFillObject}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="disk"
                          placeholder={DEFAULT_PLACEHOLDER}
                        />
                      ) : null}
                      {LinearGradient ? (
                        <LinearGradient
                          colors={collection.gradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFillObject}
                        />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: collection.gradient[0] }]} />
                      )}
                      <View style={styles.collectionContent}>
                        <View style={styles.collectionHeader}>
                          <Text style={[styles.collectionTitle, { color: palette.copy }]} numberOfLines={1}>
                            {collection.title}
                          </Text>
                          <Text style={[styles.collectionSubtitle, { color: palette.copyMuted }]} numberOfLines={2}>
                            {collection.subtitle}
                          </Text>
                        </View>
                        <Text style={[styles.collectionDescription, { color: palette.copy }]} numberOfLines={3}>
                          {collection.description}
                        </Text>
                        <View style={styles.swatchRow}>
                          {collection.swatches.map((swatch, swatchIdx) => (
                            <View
                              key={`${collection.handle}-${swatchIdx}`}
                              style={[
                                styles.swatch,
                                {
                                  backgroundColor: swatch,
                                  marginRight: swatchIdx === collection.swatches.length - 1 ? 0 : 10,
                                },
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={[styles.collectionCta, { color: palette.accent }]} numberOfLines={1}>
                          {collection.cta}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <View style={styles.bottomNote}>
            <Text style={[styles.bottomTitle, { color: palette.caption }]}>The {isWomen ? "Women" : "Men"} Story</Text>
            <Text style={[styles.bottomCopy, { color: palette.caption }]}>
              {isWomen
                ? "A poetic collision of iridescent fabrics, sculptural volume, and metallic flora. Each look is an invitation to move between gallery spotlights and midnight rooftops."
                : "Engineered layers, tonal shadowplay, and disciplined structure form an urban uniform for after-hours skylines. Crafted for those rewriting the sartorial rulebook."}
            </Text>
          </View>
        </View>
        <View style={{ height: 72 }}>
          {LinearGradient ? (
            <LinearGradient
              colors={transitionGradient}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: transitionGradient[0] }]} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  heroContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 44,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 48,
  },
  heroFooter: {
    marginTop: 28,
  },
  signature: {
    fontSize: 16,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  rule: {
    marginTop: 14,
    height: 2,
    width: 96,
  },
  blurCard: {
    position: "absolute",
    right: 24,
    bottom: 24,
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  blurTitle: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  blurCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 12,
    marginTop: 8,
  },
  chipText: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 8,
  },
  heroChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 12,
    marginBottom: 10,
  },
  heroChipText: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 12,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    marginRight: 10,
  },
  sectionLabel: {
    fontSize: 13,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  collectionCard: {
    borderRadius: 28,
    overflow: "hidden",
    padding: 20,
    position: "relative",
    aspectRatio: 1,
  },
  collectionContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  collectionHeader: {
    marginBottom: 14,
  },
  collectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  collectionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  collectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  swatchRow: {
    flexDirection: "row",
    marginBottom: 18,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  collectionCta: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 4,
  },
  bottomNote: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 32,
  },
  bottomTitle: {
    fontSize: 16,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  bottomCopy: {
    fontSize: 14,
    lineHeight: 22,
  },
})
