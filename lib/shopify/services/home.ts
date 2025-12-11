import { callShopify, shopifyClient } from "@/lib/shopify/client"
import { MobileHomeDocument, type MobileHomeQuery } from "@/lib/shopify/gql/graphql"
import { currentLocale } from "@/store/prefs"

export type ImageRef = { url: string; w?: number | null; h?: number | null; alt?: string | null }
export type SectionSize = "small" | "medium" | "large"
export type HorizontalAlign = "left" | "center" | "right"
export type VerticalAlign = "top" | "center" | "bottom"
export type AlignSetting =
  | HorizontalAlign
  | VerticalAlign
  | `${VerticalAlign}-${HorizontalAlign}`
  | `${VerticalAlign} ${HorizontalAlign}`
  | `${HorizontalAlign}-${VerticalAlign}`
  | `${HorizontalAlign} ${VerticalAlign}`
  | (string & {})

export type PosterCell = {
  image?: ImageRef
  url?: string
  title?: string
  subtitle?: string
  eyebrow?: string
  background?: string
  foreground?: string
  align?: AlignSetting
  layout?: string
}
export type SliderLinkItem = {
  image?: ImageRef
  url?: string
  label?: string
}

export type AppHome = { sections: AppHomeSection[] }

export type AppHomeSection =
  | {
      kind: "hero_poster"
      id: string
      title?: string
      image?: ImageRef
      url?: string
      theme?: string
      align?: AlignSetting
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "headline_promo"
      id: string
      title?: string
      url?: string
      theme?: string
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "ribbon_marquee"
      id: string
      text?: string
      speed?: number
      theme?: string
      url?: string
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "split_banner"
      id: string
      title?: string
      image?: ImageRef
      url?: string
      theme?: string
      align?: AlignSetting
      eyebrow?: string
      ctaLabel?: string
      height?: number
      tint?: number
      uppercaseTitle?: boolean
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "poster_triptych"
      id: string
      items: PosterCell[]
      theme?: string
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "poster_quilt"
      id: string
      items: PosterCell[]
      theme?: string
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "image_carousel"
      id: string
      items: PosterCell[]
      theme?: string
      height?: number
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "collection_link_slider"
      id: string
      title?: string
      items: SliderLinkItem[]
      theme?: string
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "image_link_slider"
      id: string
      title?: string
      items: SliderLinkItem[]
      theme?: string
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "duo_poster"
      id: string
      left?: { image?: ImageRef; url?: string; title?: string; subtitle?: string }
      right?: { image?: ImageRef; url?: string; title?: string; subtitle?: string }
      align?: AlignSetting
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "brand_cloud"
      id: string
      title?: string
      theme?: string
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "trio_grid"
      id: string
      a?: { image?: ImageRef; url?: string }
      b?: { image?: ImageRef; url?: string }
      c?: { image?: ImageRef; url?: string }
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "product_rail"
      id: string
      title?: string
      collectionHandle?: string
      theme?: string
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }
  | {
      kind: "editorial_quote"
      id: string
      title?: string
      theme?: string
      url?: string
      size?: SectionSize
      country?: string
      language?: string
      startAt?: string
      endAt?: string
      collectionUrls?: string[]
    }

// fetch
export async function getMobileHome(handle = "app-home", language?: string) {
  const lang = (language as any) ?? currentLocale().language
  return callShopify<MobileHomeQuery>(() => shopifyClient.request(MobileHomeDocument, { handle, language: lang }))
}

const SUPPORTED_KINDS: AppHomeSection["kind"][] = [
  "hero_poster",
  "headline_promo",
  "ribbon_marquee",
  "split_banner",
  "poster_triptych",
  "poster_quilt",
  "image_carousel",
  "collection_link_slider",
  "image_link_slider",
  "duo_poster",
  "brand_cloud",
  "trio_grid",
  "product_rail",
  "editorial_quote",
] as const

const SUPPORTED_KIND_SET = new Set<AppHomeSection["kind"]>(SUPPORTED_KINDS)
const COLLAPSED_KIND_MAP = SUPPORTED_KINDS.reduce<Record<string, AppHomeSection["kind"]>>((acc, kind) => {
  acc[kind.replace(/_/g, "")] = kind
  return acc
}, {})
const KIND_SYNONYMS: Record<string, AppHomeSection["kind"]> = {
  collectionslider: "collection_link_slider",
  collectionlinkslider: "collection_link_slider",
  collectionsliderlink: "collection_link_slider",
  imagesliderlink: "image_link_slider",
}
const FALSEY_STRINGS = new Set(["false", "0", "off", "no"])

function normalizeKind(raw?: string | null): AppHomeSection["kind"] | undefined {
  if (!raw) return
  const trimmed = raw.trim()
  if (!trimmed) return
  const lower = trimmed.toLowerCase()
  const normalized = lower.replace(/[\s-]+/g, "_")
  if (SUPPORTED_KIND_SET.has(normalized as AppHomeSection["kind"])) {
    return normalized as AppHomeSection["kind"]
  }
  const collapsed = normalized.replace(/_/g, "")
  if (collapsed in KIND_SYNONYMS) {
    return KIND_SYNONYMS[collapsed]
  }
  return COLLAPSED_KIND_MAP[collapsed]
}

// normalize
export function normalizeHome(data: MobileHomeQuery | null | undefined): AppHome {
  const fields = data?.metaobject?.fields ?? []
  const sectionsField = fields.find((f) => f.key === "sections")
  const refs = sectionsField?.references
  const nodes = (refs?.nodes ?? (refs as any)?.edges?.map((e: any) => e?.node) ?? []).filter(Boolean)

  const raw = nodes
    .map((n: any) => {
      const parsed = toSection(n)
      if (!parsed && __DEV__) {
        console.warn("[Home] skipped section metaobject", summarizeMetaobject(n))
      }
      return parsed
    })
    .filter(Boolean) as AppHomeSection[]

  // optional targeting/scheduling
  const { country, language } = currentLocale()
  const activeCountry = normalizeCountryCode(country)
  const activeLanguage = normalizeLanguageCode(language)
  const now = Date.now()
  const sections = raw.filter((s) => {
    const targetCountry = normalizeCountryCode((s as any).country)
    const targetLanguage = normalizeLanguageCode((s as any).language)
    if (targetCountry && activeCountry && targetCountry !== activeCountry) return false
    if (targetLanguage && activeLanguage && targetLanguage !== activeLanguage) return false
    const sa = (s as any).startAt as string | undefined
    const ea = (s as any).endAt as string | undefined
    if (sa && now < Date.parse(sa)) return false
    if (ea && now > Date.parse(ea)) return false
    return true
  })

  logHomeSections(raw, sections)

  return { sections }
}

// helpers
function normalizeFieldKey(key?: string | null) {
  const trimmed = key?.trim()
  if (!trimmed) return ""
  return trimmed.replace(/[\s_-]+/g, "").toLowerCase()
}
function getField(node: any, key: string) {
  const fields = node?.fields ?? []
  const target = normalizeFieldKey(key)
  if (!target) return undefined
  return fields.find((f: any) => normalizeFieldKey(f?.key) === target)
}
function parseListValue(raw?: string | null): string[] | undefined {
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => {
          if (entry == null) return ""
          return String(entry).trim()
        })
      }
    } catch {
      // ignore malformed JSON and fall through
    }
  }
  if (trimmed.includes("\n")) {
    return trimmed
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
  }
  return undefined
}
function valueFromFieldAt(field: any, index: number) {
  if (!field) return undefined
  const list = parseListValue(field.value)
  if (list && list[index]) return list[index]
  if (index === 0 && typeof field.value === "string") return field.value
  return undefined
}
function refFromFieldAt(field: any, index: number) {
  if (!field) return undefined
  const list = getReferenceNodes(field)
  if (list[index]) return list[index]
  if (index === 0) return field.reference ?? list[0]
  return undefined
}
function val(node: any, key: string) {
  const field = getField(node, key)
  return valueFromFieldAt(field, 0)
}
function ref(node: any, key: string) {
  const field = getField(node, key)
  return refFromFieldAt(field, 0)
}
function fieldUrl(node: any, key: string, index = 0) {
  const field = getField(node, key)
  if (!field) return undefined

  const referencedUrl = prioritizedReferenceUrl(field, index)
  if (referencedUrl) return referencedUrl

  const value = valueFromFieldAt(field, index)
  if (typeof value === "string" && value.trim()) return value.trim()

  const refNode = refFromFieldAt(field, index)
  return refToUrl(refNode)
}

function valAt(node: any, key: string, index: number) {
  if (index === 0) return val(node, key)
  const baseField = getField(node, key)
  const listVal = valueFromFieldAt(baseField, index)
  if (listVal != null) return listVal
  const suffix = String(index + 1)
  return val(node, `${key}${suffix}`) ?? val(node, `${key}_${suffix}`)
}
function refAt(node: any, key: string, index: number) {
  if (index === 0) return ref(node, key)
  const baseField = getField(node, key)
  const listRef = refFromFieldAt(baseField, index)
  if (listRef) return listRef
  const suffix = String(index + 1)
  return ref(node, `${key}${suffix}`) ?? ref(node, `${key}_${suffix}`)
}
function urlAt(node: any, key: string, index: number) {
  const baseKeys = ["collection", "collections", key, "link"]

  const tryKeysWithIndex = (idx: number) => {
    for (const candidate of baseKeys) {
      const fromField = fieldUrl(node, candidate, idx)
      if (fromField) return fromField
    }
    return undefined
  }

  const direct = tryKeysWithIndex(index)
  if (direct) return direct

  const suffix = String(index + 1)
  for (const candidate of baseKeys) {
    const suffixed = fieldUrl(node, `${candidate}${suffix}`) ?? fieldUrl(node, `${candidate}_${suffix}`)
    if (suffixed) return suffixed
  }

  return undefined
}

function prioritizedReferenceUrl(field: any, index: number) {
  const refNode = refFromFieldAt(field, index)
  const collectionUrl = refToCollectionUrl(refNode)
  if (collectionUrl) return collectionUrl

  const list = getReferenceNodes(field)
  const collection = list[index] ?? list.find((ref: any) => refToCollectionUrl(ref))
  const fallbackCollectionUrl = refToCollectionUrl(collection)
  if (fallbackCollectionUrl) return fallbackCollectionUrl

  return refToUrl(refNode)
}
function imgFrom(r: any): ImageRef | undefined {
  if (!r) return undefined
  const img = r.image
  if (img?.url) return { url: img.url, w: img.width, h: img.height, alt: img.altText }
  if (typeof r.url === "string") return { url: r.url, w: r.width, h: r.height, alt: r.altText }
  if (typeof r.originalSrc === "string") return { url: r.originalSrc, w: r.width, h: r.height, alt: r.altText }
  return undefined
}

function getReferenceNodes(field: any): any[] {
  const nodes = field?.references?.nodes
  if (Array.isArray(nodes)) return nodes.filter(Boolean)
  const edges = field?.references?.edges
  if (Array.isArray(edges)) return edges.map((e: any) => e?.node).filter(Boolean)
  return []
}

function refToCollectionUrl(ref: any): string | undefined {
  if (ref?.__typename === "Collection") {
    return ref.handle ? `/collections/${ref.handle}` : undefined
  }
  return undefined
}

function refToUrl(ref: any): string | undefined {
  if (!ref) return undefined
  const collectionUrl = refToCollectionUrl(ref)
  if (collectionUrl) return collectionUrl
  switch (ref.__typename) {
    case "Product":
      return ref.handle ? `/products/${ref.handle}` : undefined
    default:
      return undefined
  }
}

function normalizeCountryCode(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.toUpperCase()
}

function normalizeLanguageCode(value?: string | null) {
  return normalizeCountryCode(value)
}

function parseNumber(value?: string | null) {
  if (typeof value !== "string") return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num))
}

function parseBoolean(value?: string | null): boolean | undefined {
  if (value == null) return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  if (FALSEY_STRINGS.has(normalized)) return false
  return true
}

function normalizeSize(value?: string | null): SectionSize {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return "medium"
  if (normalized === "small" || normalized === "s") return "small"
  if (normalized === "large" || normalized === "l") return "large"
  if (normalized === "medium" || normalized === "m") return "medium"
  return "medium"
}

const MAX_SCROLLABLE_ITEMS = 50
const DEFAULT_IMAGE_CAROUSEL_COUNT = 3
const DEFAULT_IMAGE_LINK_SLIDER_COUNT = 3

function detectedImageFieldCount(node: any) {
  const fields = node?.fields ?? []
  let maxIndex = 0

  fields.forEach((field: any, idx: number) => {
    const normalizedKey = normalizeFieldKey(field?.key)
    if (!normalizedKey.startsWith("image")) return
    const suffix = normalizedKey.slice("image".length)
    if (!suffix) {
      maxIndex = Math.max(maxIndex, 1)
      return
    }
    const parsed = Number(suffix)
    if (Number.isFinite(parsed)) {
      maxIndex = Math.max(maxIndex, parsed)
      return
    }
    maxIndex = Math.max(maxIndex, idx + 1)
  })

  const referencedImages = collectImageRefs(node).length
  return Math.max(maxIndex, referencedImages)
}

function logHomeSections(raw: AppHomeSection[], filtered: AppHomeSection[]) {
  if (typeof console === "undefined" || (typeof __DEV__ !== "undefined" && !__DEV__)) return
  const summarize = (items: AppHomeSection[]) =>
    items.map((item) => ({
      id: item.id,
      kind: item.kind,
      size: item.size ?? "medium",
      country: (item as any).country ?? "*",
      language: (item as any).language ?? "*",
      startAt: (item as any).startAt ?? null,
      endAt: (item as any).endAt ?? null,
      detail: sectionDetail(item),
    }))
  console.log(`[Home] sections raw (${raw.length})`, summarize(raw))
  console.log(`[Home] sections after gating (${filtered.length})`, summarize(filtered))
}

function sectionDetail(section: AppHomeSection) {
  switch (section.kind) {
    case "trio_grid":
      return {
        a: Boolean(section.a?.image?.url),
        b: Boolean(section.b?.image?.url),
        c: Boolean(section.c?.image?.url),
      }
    case "duo_poster":
      return {
        left: Boolean(section.left?.image?.url),
        right: Boolean(section.right?.image?.url),
      }
    case "product_rail":
      return {
        collectionHandle: section.collectionHandle ?? null,
        hasTitle: Boolean(section.title),
      }
    case "split_banner":
      return {
        hasImage: Boolean(section.image?.url),
        align: section.align,
        tint: section.tint ?? null,
      }
    case "image_link_slider":
    case "collection_link_slider":
      return {
        tiles: section.items.length,
        hasHeading: Boolean(section.title),
        handles: (section.items as SliderLinkItem[]).map((i) => i.url).slice(0, 6),
      }
    default:
      return undefined
  }
}

function toSection(node: any): AppHomeSection | null {
  const kind = normalizeKind(val(node, "kind"))
  const title = val(node, "title")
  const subtitle = val(node, "subtitle")
  const collections = collectCollections(node)
  const collectionUrls = uniqueCollectionUrls(collections)
  const url = collectionUrls[0] ?? fieldUrl(node, "url") ?? fieldUrl(node, "link")
  const theme = val(node, "theme") ?? "light"
  const country = normalizeCountryCode(val(node, "country"))
  const language = normalizeLanguageCode(val(node, "language"))
  const startAt = val(node, "startAt")
  const endAt = val(node, "endAt")
  const size = normalizeSize(val(node, "size"))
  const targeting = { size, country, language, startAt, endAt, collectionUrls }

  switch (kind) {
    case "hero_poster": {
      const imageRef = ref(node, "image")
      return {
        kind,
        id: node.id,
        title,
        url,
        theme,
        align: (val(node, "align") as any) ?? undefined,
        image: imgFrom(imageRef),
        ...targeting,
      }
    }
    case "headline_promo":
      return { kind, id: node.id, title, url, theme, ...targeting }

    case "ribbon_marquee": {
      const text = title || subtitle || "" // use either; prefer title
      const speedRaw = val(node, "speed")
      const parsedSpeed = Number(speedRaw)
      const speed = Number.isFinite(parsedSpeed) && parsedSpeed !== 0 ? parsedSpeed : 30
      return { kind, id: node.id, text, speed, theme, url, ...targeting }
    }

    case "split_banner": {
      const imageRef = ref(node, "image")
      const align = (val(node, "align") as any) ?? "left"
      const height = parseNumber(val(node, "height"))
      const eyebrow = val(node, "eyebrow")
      const ctaLabel = val(node, "ctaLabel") ?? val(node, "cta_label")
      const tintValue = parseNumber(val(node, "tint"))
      const tint = typeof tintValue === "number" ? clamp(tintValue, 0, 1) : undefined
      const uppercaseTitle = parseBoolean(val(node, "uppercaseTitle") ?? val(node, "uppercase_title"))
      return {
        kind,
        id: node.id,
        title,
        url,
        theme,
        image: imgFrom(imageRef),
        align,
        eyebrow,
        ctaLabel,
        height,
        tint,
        uppercaseTitle,
        ...targeting,
      }
    }

    case "poster_triptych": {
      const countRaw = parseNumber(val(node, "count"))
      const requestedCount = typeof countRaw === "number" && countRaw > 0 ? Math.round(countRaw) : undefined
      const detectedImages = detectedImageFieldCount(node)
      const fallbackCount = Math.max(3, detectedImages)
      const count = clamp(requestedCount ?? fallbackCount, 1, 6)
      const items: PosterCell[] = []
      for (let i = 0; i < count; i += 1) {
        const imageRef = refAt(node, "image", i)
        const item: PosterCell = {
          image: imgFrom(imageRef),
          url: urlAt(node, "url", i) ?? urlAt(node, "link", i),
          title: valAt(node, "title", i),
          subtitle: valAt(node, "subtitle", i),
          eyebrow: valAt(node, "eyebrow", i),
          background: valAt(node, "background", i) ?? valAt(node, "bg", i),
          foreground: valAt(node, "foreground", i) ?? valAt(node, "fg", i),
          align: (valAt(node, "align", i) as any) ?? undefined,
          layout: valAt(node, "layout", i) ?? undefined,
        }
        const hasContent = item.image || item.title || item.subtitle || item.background
        if (hasContent) items.push(item)
      }
      return { kind, id: node.id, items, theme, ...targeting }
    }

    case "poster_quilt": {
      const countRaw = parseNumber(val(node, "count"))
      const requestedCount = typeof countRaw === "number" && countRaw > 0 ? Math.round(countRaw) : undefined
      const detectedImages = detectedImageFieldCount(node)
      const fallbackCount = Math.max(5, detectedImages)
      const count = clamp(requestedCount ?? fallbackCount, 1, 8)
      const items: PosterCell[] = []
      for (let i = 0; i < count; i += 1) {
        const imageRef = refAt(node, "image", i)
        const item: PosterCell = {
          image: imgFrom(imageRef),
          url: urlAt(node, "url", i) ?? urlAt(node, "link", i),
          title: valAt(node, "title", i),
          subtitle: valAt(node, "subtitle", i),
          eyebrow: valAt(node, "eyebrow", i),
          background: valAt(node, "background", i) ?? valAt(node, "bg", i),
          foreground: valAt(node, "foreground", i) ?? valAt(node, "fg", i),
          align: (valAt(node, "align", i) as any) ?? undefined,
          layout: valAt(node, "layout", i) ?? undefined,
        }
        const hasContent = item.image || item.title || item.subtitle || item.background
        if (hasContent) items.push(item)
      }
      return { kind, id: node.id, items, theme, ...targeting }
    }

    case "image_carousel": {
      const countRaw = parseNumber(val(node, "count"))
      const requestedCount = typeof countRaw === "number" && countRaw > 0 ? Math.round(countRaw) : undefined
      const detectedImages = detectedImageFieldCount(node)
      const fallbackCount = Math.max(DEFAULT_IMAGE_CAROUSEL_COUNT, detectedImages)
      const count = clamp(requestedCount ?? fallbackCount, 1, MAX_SCROLLABLE_ITEMS)
      const heightRaw = Number(val(node, "height") ?? val(node, "imageHeight"))
      const height = Number.isFinite(heightRaw) && heightRaw > 0 ? Math.round(heightRaw) : undefined
      const items: PosterCell[] = []
      for (let i = 0; i < count; i += 1) {
        const imageRef = refAt(node, "image", i)
        const item: PosterCell = {
          image: imgFrom(imageRef),
          url: urlAt(node, "url", i) ?? urlAt(node, "link", i),
          title: valAt(node, "title", i),
          subtitle: valAt(node, "subtitle", i),
          eyebrow: valAt(node, "eyebrow", i),
          background: valAt(node, "background", i) ?? valAt(node, "bg", i),
          foreground: valAt(node, "foreground", i) ?? valAt(node, "fg", i),
          align: (valAt(node, "align", i) as any) ?? undefined,
          layout: valAt(node, "layout", i) ?? undefined,
        }
        const hasContent = item.image
        if (hasContent) items.push(item)
      }
      if (!items.length) return null
      return { kind, id: node.id, items, theme, height, ...targeting }
    }

    case "image_link_slider": {
      const countRaw = parseNumber(val(node, "count"))
      const requestedCount = typeof countRaw === "number" && countRaw > 0 ? Math.round(countRaw) : undefined
      const detectedImages = detectedImageFieldCount(node)
      const fallbackCount = Math.max(DEFAULT_IMAGE_LINK_SLIDER_COUNT, detectedImages)
      const count = clamp(requestedCount ?? fallbackCount, 1, MAX_SCROLLABLE_ITEMS)
      const items: SliderLinkItem[] = []
      for (let i = 0; i < count; i += 1) {
        const imageRef = refAt(node, "image", i)
        const image = imgFrom(imageRef)
        if (!image?.url) continue
        const link = urlAt(node, "url", i) ?? urlAt(node, "link", i)
        const label = valAt(node, "title", i) ?? valAt(node, "eyebrow", i)
        items.push({ image, url: link, label: label ?? undefined })
      }
      if (!items.length) return null
      const heading = val(node, "sectionTitle") ?? val(node, "heading") ?? title ?? subtitle
      return { kind, id: node.id, title: heading ?? undefined, items, theme, ...targeting }
    }

    case "collection_link_slider": {
      const collectionsField = getField(node, "collections") ?? getField(node, "collection")
      const countRaw = parseNumber(val(node, "count"))
      const requestedCount = typeof countRaw === "number" && countRaw > 0 ? Math.round(countRaw) : undefined
      const fallbackCount = collections.length
      const count = clamp(requestedCount ?? fallbackCount, 0, MAX_SCROLLABLE_ITEMS)
      const items: SliderLinkItem[] = []
      for (let i = 0; i < count; i += 1) {
        const coll = collections[i]
        if (!coll?.handle) continue
        const overrideImage = refAt(node, "image", i)
        const image = imgFrom(overrideImage) ?? imgFrom(coll.image)
        if (!image?.url) continue
        const url = `/collections/${coll.handle}`
        const rawLabel = valAt(node, "title", i)
        const label = rawLabel && rawLabel.trim() ? rawLabel : coll.title
        items.push({ image, url, label: label ?? undefined })
      }
      if (!items.length) {
        if (__DEV__) {
          console.warn("[Home] collection_link_slider has no renderable items", {
            collections: collections.length,
            requestedCount,
            fieldHasReference: Boolean(collectionsField?.reference),
            fieldReferenceTypename: collectionsField?.reference?.__typename ?? null,
            listRefs: getReferenceNodes(collectionsField).map((r) => r?.__typename ?? null),
            fieldKeys: (node?.fields ?? []).map((f: any) => f?.key),
          })
        }
        return null
      }
      const heading = val(node, "sectionTitle") ?? val(node, "heading") ?? title ?? subtitle
      return { kind, id: node.id, title: heading ?? undefined, items, theme, ...targeting }
    }

    case "duo_poster": {
      const orderedImages = collectImageRefs(node)
      const imageL = ref(node, "image") ?? ref(node, "image_left") ?? orderedImages[0]
      const imageR = ref(node, "image2") ?? ref(node, "image_right") ?? orderedImages[1]
      const urlRight =
        urlAt(node, "url", 1) ?? urlAt(node, "link", 1) ?? fieldUrl(node, "url2") ?? fieldUrl(node, "link2")
      const titleLeft = valAt(node, "title", 0) ?? val(node, "title") ?? val(node, "title_left")
      const titleRight = valAt(node, "title", 1) ?? val(node, "title2") ?? val(node, "title_right")
      const align = (val(node, "align") as any) ?? undefined
      return {
        kind,
        id: node.id,
        left: { image: imgFrom(imageL), url, title: titleLeft ?? undefined, subtitle: undefined },
        right: {
          image: imgFrom(imageR),
          url: urlRight,
          title: titleRight ?? undefined,
          subtitle: undefined,
        },
        align,
        ...targeting,
      }
    }

    case "trio_grid": {
      const [aRef, bRef, cRef] = collectImageRefs(node)
      const urlA = urlAt(node, "url", 0) ?? urlAt(node, "link", 0)
      const urlB = urlAt(node, "url", 1) ?? urlAt(node, "link", 1)
      const urlC = urlAt(node, "url", 2) ?? urlAt(node, "link", 2)
      return {
        kind,
        id: node.id,
        a: { image: imgFrom(aRef ?? ref(node, "image")), url: urlA },
        b: { image: imgFrom(bRef ?? ref(node, "image2")), url: urlB },
        c: { image: imgFrom(cRef ?? ref(node, "image3")), url: urlC },
        ...targeting,
      }
    }

    case "product_rail": {
      const coll = ref(node, "collection")
      const handleText = val(node, "collectionHandle") ?? val(node, "collection_handle")
      const handle = (coll?.handle as string | undefined) ?? handleText ?? undefined
      return { kind, id: node.id, title, collectionHandle: handle, theme, ...targeting }
    }

    case "editorial_quote":
      return { kind, id: node.id, title, theme, url, ...targeting }

    case "brand_cloud":
      return { kind, id: node.id, title, theme, ...targeting }

    default:
      return null
  }
}

function collectImageRefs(node: any) {
  const fields = node?.fields ?? []
  const refs: Array<{ order: number; ref: any }> = []
  fields.forEach((field: any, idx: number) => {
    const normalizedKey = normalizeFieldKey(field?.key)
    if (!normalizedKey.startsWith("image")) return
    const order = orderForImageKey(normalizedKey, idx)
    if (field?.reference) refs.push({ order, ref: field.reference })
    const list = getReferenceNodes(field)
    list.forEach((refNode: any, listIdx: number) => {
      refs.push({ order: order + listIdx / 10, ref: refNode })
    })
  })
  refs.sort((a, b) => a.order - b.order)
  return refs.map((entry) => entry.ref).filter(Boolean)
}

function orderForImageKey(normalizedKey: string, fallback: number) {
  if (!normalizedKey.startsWith("image")) return fallback
  const suffix = normalizedKey.slice("image".length)
  if (!suffix) return fallback
  if (/^\d+$/.test(suffix)) return Number(suffix)
  const firstChar = suffix.charCodeAt(0)
  if (Number.isFinite(firstChar)) return fallback + (firstChar - 96)
  return fallback
}

function collectCollections(node: any) {
  const collectionsField = getField(node, "collections") ?? getField(node, "collection")
  if (!collectionsField) return []
  const refs = getReferenceNodes(collectionsField)
  if (collectionsField.reference) refs.unshift(collectionsField.reference)
  return refs.filter(Boolean)
}

function uniqueCollectionUrls(collections: any[]) {
  const seen = new Set<string>()
  const urls: string[] = []
  collections.forEach((coll) => {
    const handle = typeof coll?.handle === "string" ? coll.handle.trim() : ""
    if (!handle) return
    const url = `/collections/${handle}`
    if (!seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  })
  return urls
}

function summarizeMetaobject(node: any) {
  const kind = val(node, "kind") ?? node?.type ?? "unknown"
  const id = node?.id ?? "?"
  const keys = (node?.fields ?? []).map((f: any) => f?.key).filter(Boolean)
  return { id, kind, keys }
}
