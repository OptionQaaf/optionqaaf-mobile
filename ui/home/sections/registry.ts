import { BrandCloud } from "./BrandCloud"
import { DuoPoster } from "./DuoPoster"
import { EditorialQuote } from "./EditorialQuote"
import { HeadlinePromo } from "./HeadlinePromo"
import { HeroPoster } from "./HeroPoster"
import { ImageCarouselSection } from "./ImageCarouselSection/ImageCarouselSection"
import { PosterQuilt } from "./PosterQuilt"
import { PosterTriptych } from "./PosterTriptych"
import { ProductRail } from "./ProductRail"
import { RibbonMarquee } from "./RibbonMarquee"
import { SplitBanner } from "./SplitBanner"
import { TrioGrid } from "./TrioGrid"

export const sectionRegistry = {
  hero_poster: HeroPoster,
  headline_promo: HeadlinePromo,
  ribbon_marquee: RibbonMarquee,
  split_banner: SplitBanner,
  poster_triptych: PosterTriptych,
  poster_quilt: PosterQuilt,
  duo_poster: DuoPoster,
  trio_grid: TrioGrid,
  product_rail: ProductRail,
  editorial_quote: EditorialQuote,
  brand_cloud: BrandCloud,
  image_carousel: ImageCarouselSection,
} as const

export type SectionKind = keyof typeof sectionRegistry
