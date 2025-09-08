import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { MobileHomeDocument, type MobileHomeQuery } from "@/lib/shopify/gql/graphql"
import { currentLocale } from "@/store/prefs"

export type ImageRef = { url: string; w?: number | null; h?: number | null; alt?: string | null }
export type AppHome = { sections: AppHomeSection[] }

export type AppHomeSection =
  | {
      kind: "hero_poster"
      id: string
      title?: string
      subtitle?: string
      image?: ImageRef
      url?: string
      theme?: string
      country?: string
      language?: string
      startAt?: string
      endAt?: string
    }
  | {
      kind: "headline_promo"
      id: string
      title?: string
      subtitle?: string
      url?: string
      theme?: string
      country?: string
      language?: string
      startAt?: string
      endAt?: string
    }
  | {
      kind: "ribbon_marquee"
      id: string
      text?: string
      speed?: number
      theme?: string
      url?: string
      country?: string
      language?: string
      startAt?: string
      endAt?: string
    }
  | {
      kind: "split_banner"
      id: string
      title?: string
      subtitle?: string
      image?: ImageRef
      url?: string
      theme?: string
      align?: "left" | "center" | "right"
      country?: string
      language?: string
      startAt?: string
      endAt?: string
    }
  | {
      kind: "duo_poster"
      id: string
      left?: { image?: ImageRef; url?: string }
      right?: { image?: ImageRef; url?: string }
      country?: string
      language?: string
      startAt?: string
      endAt?: string
    }
  | {
      kind: "trio_grid"
      id: string
      a?: { image?: ImageRef; url?: string }
      b?: { image?: ImageRef; url?: string }
      c?: { image?: ImageRef; url?: string }
      country?: string
      language?: string
      startAt?: string
      endAt?: string
    }
  | {
      kind: "product_rail"
      id: string
      title?: string
      subtitle?: string
      collectionHandle?: string
      theme?: string
      country?: string
      language?: string
      startAt?: string
      endAt?: string
    }
  | {
      kind: "editorial_quote"
      id: string
      title?: string
      subtitle?: string
      theme?: string
      url?: string
      country?: string
      language?: string
      startAt?: string
      endAt?: string
    }

// fetch
export async function getMobileHome(handle = "app-home", language?: string) {
  const lang = (language as any) ?? currentLocale().language
  return callShopify<MobileHomeQuery>(() => shopifyClient.request(MobileHomeDocument, { handle, language: lang }))
}

// normalize
export function normalizeHome(data: MobileHomeQuery | null | undefined): AppHome {
  const fields = data?.metaobject?.fields ?? []
  const sectionsField = fields.find((f) => f.key === "sections")
  const refs = sectionsField?.references
  const nodes = (refs?.nodes ?? (refs as any)?.edges?.map((e: any) => e?.node) ?? []).filter(Boolean)

  const raw = nodes.map((n: any) => toSection(n)).filter(Boolean) as AppHomeSection[]

  // optional targeting/scheduling
  const { country, language } = currentLocale()
  const now = Date.now()
  const sections = raw.filter((s) => {
    if ((s as any).country && (s as any).country !== country) return false
    if ((s as any).language && (s as any).language !== language) return false
    const sa = (s as any).startAt as string | undefined
    const ea = (s as any).endAt as string | undefined
    if (sa && now < Date.parse(sa)) return false
    if (ea && now > Date.parse(ea)) return false
    return true
  })

  return { sections }
}

// helpers
function val(node: any, key: string) {
  return node?.fields?.find((f: any) => f.key === key)?.value
}
function ref(node: any, key: string) {
  return node?.fields?.find((f: any) => f.key === key)?.reference
}
function imgFrom(r: any): ImageRef | undefined {
  const img = r?.image
  if (!img?.url) return
  return { url: img.url, w: img.width, h: img.height, alt: img.altText }
}

function toSection(node: any): AppHomeSection | null {
  const kind = val(node, "kind") as AppHomeSection["kind"] | undefined
  const title = val(node, "title")
  const subtitle = val(node, "subtitle")
  const url = val(node, "url") ?? val(node, "link")
  const theme = val(node, "theme") ?? "light"
  const country = val(node, "country")
  const language = val(node, "language")
  const startAt = val(node, "startAt")
  const endAt = val(node, "endAt")

  switch (kind) {
    case "hero_poster": {
      const imageRef = ref(node, "image")
      return {
        kind,
        id: node.id,
        title,
        subtitle,
        url,
        theme,
        image: imgFrom(imageRef),
        country,
        language,
        startAt,
        endAt,
      }
    }
    case "headline_promo":
      return { kind, id: node.id, title, subtitle, url, theme, country, language, startAt, endAt }

    case "ribbon_marquee": {
      const text = title || subtitle || "" // use either; prefer title
      const speed = parseInt(val(node, "speed") || "30", 10) || 30
      return { kind, id: node.id, text, speed, theme, url, country, language, startAt, endAt }
    }

    case "split_banner": {
      const imageRef = ref(node, "image")
      const align = (val(node, "align") as any) ?? "left"
      return {
        kind,
        id: node.id,
        title,
        subtitle,
        url,
        theme,
        image: imgFrom(imageRef),
        align,
        country,
        language,
        startAt,
        endAt,
      }
    }

    case "duo_poster": {
      const imageL = ref(node, "image")
      const imageR = ref(node, "image2")
      const url2 = val(node, "url2") ?? val(node, "link2")
      return {
        kind,
        id: node.id,
        left: { image: imgFrom(imageL), url },
        right: { image: imgFrom(imageR), url: url2 },
        country,
        language,
        startAt,
        endAt,
      }
    }

    case "trio_grid": {
      const a = ref(node, "image")
      const b = ref(node, "image2")
      const c = ref(node, "image3")
      const u2 = val(node, "url2") ?? val(node, "link2")
      const u3 = val(node, "url3") ?? val(node, "link3")
      return {
        kind,
        id: node.id,
        a: { image: imgFrom(a), url },
        b: { image: imgFrom(b), url: u2 },
        c: { image: imgFrom(c), url: u3 },
        country,
        language,
        startAt,
        endAt,
      }
    }

    case "product_rail": {
      const coll = ref(node, "collection")
      const handle = coll?.handle as string | undefined
      return { kind, id: node.id, title, subtitle, collectionHandle: handle, theme, country, language, startAt, endAt }
    }

    case "editorial_quote":
      return { kind, id: node.id, title, subtitle, theme, url, country, language, startAt, endAt }

    default:
      return null
  }
}
