import { DuoPoster } from "./DuoPoster"
import { EditorialQuote } from "./EditorialQuote"
import { HeadlinePromo } from "./HeadlinePromo"
import { HeroPoster } from "./HeroPoster"
import { ProductRail } from "./ProductRail"
import { RibbonMarquee } from "./RibbonMarquee"
import { SplitBanner } from "./SplitBanner"
import { TrioGrid } from "./TrioGrid"

export const sectionRegistry = {
  hero_poster: HeroPoster,
  headline_promo: HeadlinePromo,
  ribbon_marquee: RibbonMarquee,
  split_banner: SplitBanner,
  duo_poster: DuoPoster,
  trio_grid: TrioGrid,
  product_rail: ProductRail,
  editorial_quote: EditorialQuote,
} as const

export type SectionKind = keyof typeof sectionRegistry
