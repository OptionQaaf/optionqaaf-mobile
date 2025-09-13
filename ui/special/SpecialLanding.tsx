import { SplitBanner } from "@/ui/home/sections/SplitBanner"
import { TrioGrid } from "@/ui/home/sections/TrioGrid"
import { View } from "react-native"

type Props = {
  variant?: "Men" | "Women" | string
}

// Lightweight, composable landing block for special pages (men/women)
// Uses existing home section primitives to achieve a fashion-landing vibe.
export function SpecialLanding({ variant = "Men" }: Props) {
  const heroImg =
    variant === "Women"
      ? "https://images.unsplash.com/photo-1518237271736-ab68de25d43d?q=80&w=2400"
      : "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2400"

  const trio = [
    "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=1200",
    "https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1200",
    "https://images.unsplash.com/photo-1544027993-37dbfe43562a?q=80&w=1200",
  ]

  return (
    <View className="gap-0">
      <SplitBanner
        image={{ url: heroImg }}
        eyebrow={variant === "Women" ? "Newest Drops" : "Featured Now"}
        title={variant === "Women" ? "NEWEST DROPS\nأحدث المجموعات" : "EDITORS' PICKS\nمختارات المحررين"}
        theme="dark"
        height={380}
        uppercaseTitle={false}
      />

      <TrioGrid a={{ image: { url: trio[0] } }} b={{ image: { url: trio[1] } }} c={{ image: { url: trio[2] } }} />

      <SplitBanner
        image={{ url: trio[1] }}
        eyebrow={variant === "Women" ? "Curated" : "Just In"}
        title={variant === "Women" ? "ستايلات مختارة" : "New Season Essentials"}
        theme="brand"
        height={240}
        uppercaseTitle={false}
      />
    </View>
  )
}
