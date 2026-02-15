import { extractForYouContentSignals } from "@/features/for-you/contentSignals"
import { fypSampleOncePerHandle } from "@/features/debug/fypDebug"
import { deriveSignalTags, type ForYouCandidate } from "@/features/for-you/profile"

export type PrimaryCategory =
  | "bottoms_denim"
  | "bottoms_pants"
  | "underwear"
  | "tops_hoodies"
  | "tops_shirts"
  | "outerwear"
  | "shoes"
  | "accessories"
  | "unknown"

export interface ProductIntelligence {
  primaryCategory: string
  confidenceScore: number
  subCategory?: string
  styleTokens: string[]
  materialTokens: string[]
  fitTokens: string[]
  colorTokens: string[]
  useCaseTokens: string[]
  normalizedTerms: string[]
  qualityScore: number
}

export type IntelligenceProduct = ForYouCandidate & {
  descriptionHtml?: string | null
  description?: string | null
}

const MAX_NORMALIZED_TERMS = 64
const MAX_CACHE_SIZE = 800

const GENERIC_TERMS = new Set([
  "men",
  "women",
  "male",
  "female",
  "unisex",
  "new",
  "newin",
  "new_in",
  "new-arrivals",
  "new_arrivals",
  "arrivals",
  "arrival",
  "all",
  "sale",
  "products",
  "product",
  "the",
  "with",
  "from",
  "this",
  "that",
  "and",
  "for",
])

const CATEGORY_RULES: Record<Exclude<PrimaryCategory, "unknown">, string[]> = {
  bottoms_denim: ["jean", "jeans", "denim", "straight leg", "wide leg", "bootcut"],
  bottoms_pants: ["pant", "pants", "trouser", "trousers", "cargo"],
  underwear: ["boxer", "brief", "underwear"],
  tops_hoodies: ["hoodie", "sweatshirt"],
  tops_shirts: ["shirt", "tee", "t-shirt"],
  outerwear: ["jacket", "coat", "parka"],
  shoes: ["sneaker", "boot", "loafer"],
  accessories: ["belt", "cap", "hat", "bag"],
}

const MATERIAL_TOKENS = ["cotton", "denim", "polyester", "fleece", "wool"] as const
const FIT_TOKENS = ["slim", "regular", "oversized", "relaxed", "straight", "skinny"] as const
const COLOR_TOKENS = ["black", "blue", "grey", "beige", "white", "brown"] as const
const STYLE_TOKENS = ["vintage", "washed", "distressed", "minimal", "graphic", "embroidered"] as const
const USE_CASE_TOKENS = ["summer", "winter", "casual", "formal", "gym", "streetwear"] as const

const intelligenceCache = new Map<string, ProductIntelligence>()
let intelligenceSampleCount = 0

function normalize(value?: string | null): string {
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase()
}

function tokenize(value?: string | null): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3 && !GENERIC_TERMS.has(entry) && !/^\d+$/.test(entry))
}

function unique(items: string[], limit = MAX_NORMALIZED_TERMS): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const key = normalize(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
    if (out.length >= limit) break
  }
  return out
}

function addWeighted(map: Map<string, number>, terms: string[], weight: number): void {
  for (const term of terms) {
    const key = normalize(term)
    if (!key || GENERIC_TERMS.has(key)) continue
    map.set(key, (map.get(key) ?? 0) + weight)
  }
}

function imageFilenameTokens(url?: string | null): string[] {
  if (typeof url !== "string" || !url.trim()) return []
  const clean = url.split("?")[0]
  const last = clean.split("/").filter(Boolean).pop() ?? ""
  const withoutExt = last.replace(/\.[a-z0-9]{2,5}$/i, "")
  return withoutExt
    .split(/[_\-.]+/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length >= 3 && !GENERIC_TERMS.has(entry) && !/^\d+$/.test(entry))
}

function pickAttributeTokens(terms: string[], allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed)
  return unique(
    terms.filter((term) => allowedSet.has(term)),
    12,
  )
}

function classifyCategory(terms: string[]): {
  primaryCategory: PrimaryCategory
  confidenceScore: number
  subCategory?: string
} {
  const termSet = new Set(terms)
  const joined = ` ${terms.join(" ")} `
  const scores = new Map<Exclude<PrimaryCategory, "unknown">, number>()
  const subKeywordByCategory = new Map<Exclude<PrimaryCategory, "unknown">, string>()

  for (const [category, keywords] of Object.entries(CATEGORY_RULES) as [
    Exclude<PrimaryCategory, "unknown">,
    string[],
  ][]) {
    let score = 0
    let bestKeyword = ""
    for (const keyword of keywords) {
      const normalizedKeyword = normalize(keyword)
      let hitWeight = 0
      if (normalizedKeyword.includes(" ")) {
        if (joined.includes(` ${normalizedKeyword} `)) hitWeight = 2.6
      } else if (termSet.has(normalizedKeyword)) {
        hitWeight = 2
      } else if (normalizedKeyword.endsWith("s") && termSet.has(normalizedKeyword.slice(0, -1))) {
        hitWeight = 1.6
      }
      if (hitWeight > 0) {
        score += hitWeight
        if (!bestKeyword || hitWeight > 2) bestKeyword = normalizedKeyword
      }
    }
    if (category === "bottoms_denim" && score > 0) score += 1.4
    if (category === "underwear" && score > 0) score += 1.2
    if (score > 0) {
      scores.set(category, score)
      if (bestKeyword) subKeywordByCategory.set(category, bestKeyword.replace(/\s+/g, "_"))
    }
  }

  if (!scores.size) return { primaryCategory: "unknown", confidenceScore: 0.15 }
  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])
  const [topCategory, topScore] = sorted[0]
  const secondScore = sorted[1]?.[1] ?? 0
  let adjustedTop = topScore

  if (
    (topCategory === "bottoms_denim" && scores.get("underwear")) ||
    (topCategory === "underwear" && scores.get("bottoms_denim"))
  ) {
    adjustedTop -= 0.8
  }

  const confidence = Math.max(0, Math.min(1, adjustedTop / (adjustedTop + secondScore + 1)))
  if (adjustedTop < 2 || confidence < 0.34) {
    return { primaryCategory: "unknown", confidenceScore: confidence }
  }

  return {
    primaryCategory: topCategory,
    confidenceScore: confidence,
    subCategory: subKeywordByCategory.get(topCategory),
  }
}

export function buildProductIntelligence(product: IntelligenceProduct): ProductIntelligence {
  const weightedTerms = new Map<string, number>()
  const titleTokens = tokenize(product.title)
  const handleTokens = tokenize(product.handle)
  const vendorTokens = tokenize(product.vendor)
  const productTypeTokens = tokenize(product.productType)
  const derivedTags = deriveSignalTags({
    baseTags: product.tags ?? [],
    handle: product.handle,
    title: product.title ?? null,
    vendor: product.vendor ?? null,
    productType: product.productType ?? null,
  })

  const contentSignals = extractForYouContentSignals({
    descriptionHtml: product.descriptionHtml ?? null,
    description: product.description ?? null,
    imageAltTexts: [
      product.featuredImage?.altText ?? null,
      ...((product.images?.nodes ?? []).map((node) => node?.altText ?? null) as (string | null)[]),
    ],
    handle: product.handle,
    title: product.title ?? null,
    vendor: product.vendor ?? null,
    productType: product.productType ?? null,
  })

  const imageTokens = unique(
    [
      ...imageFilenameTokens(product.featuredImage?.url),
      ...((product.images?.nodes ?? []).flatMap((node) => imageFilenameTokens(node?.url ?? null)) as string[]),
    ],
    20,
  )

  addWeighted(weightedTerms, titleTokens, 4)
  addWeighted(weightedTerms, productTypeTokens, 3.5)
  addWeighted(weightedTerms, derivedTags, 3)
  addWeighted(weightedTerms, contentSignals, 2.2)
  addWeighted(weightedTerms, handleTokens, 2)
  addWeighted(weightedTerms, imageTokens, 2)
  addWeighted(weightedTerms, vendorTokens, 0.8)

  const normalizedTerms = Array.from(weightedTerms.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .filter((term) => term.length >= 3 && !GENERIC_TERMS.has(term))
    .slice(0, MAX_NORMALIZED_TERMS)

  const category = classifyCategory(normalizedTerms)
  const materialTokens = pickAttributeTokens(normalizedTerms, MATERIAL_TOKENS)
  const fitTokens = pickAttributeTokens(normalizedTerms, FIT_TOKENS)
  const colorTokens = pickAttributeTokens(normalizedTerms, COLOR_TOKENS)
  const styleTokens = pickAttributeTokens(normalizedTerms, STYLE_TOKENS)
  const useCaseTokens = pickAttributeTokens(normalizedTerms, USE_CASE_TOKENS)

  const richness =
    (normalize(product.productType) ? 0.2 : 0) +
    Math.min(0.3, (product.tags?.length ?? 0) * 0.05) +
    Math.min(0.3, normalizedTerms.length / 80) +
    Math.min(0.2, category.confidenceScore * 0.2)

  const result: ProductIntelligence = {
    primaryCategory: category.primaryCategory,
    confidenceScore: Number(category.confidenceScore.toFixed(4)),
    subCategory: category.subCategory,
    styleTokens,
    materialTokens,
    fitTokens,
    colorTokens,
    useCaseTokens,
    normalizedTerms,
    qualityScore: Number(Math.max(0, Math.min(1, richness)).toFixed(4)),
  }
  if (intelligenceSampleCount < 5) {
    intelligenceSampleCount += 1
    fypSampleOncePerHandle("INTELLIGENCE_SAMPLE", product.handle, "INTELLIGENCE_SAMPLE", {
      handle: product.handle,
      primaryCategory: result.primaryCategory,
      confidenceScore: result.confidenceScore,
      materialTokens: result.materialTokens,
      fitTokens: result.fitTokens,
      styleTokens: result.styleTokens,
      normalizedTermsSample: result.normalizedTerms.slice(0, 8),
      qualityScore: result.qualityScore,
    })
  }
  return result
}

export function getCachedProductIntelligence(product: IntelligenceProduct): ProductIntelligence {
  const key = normalize(product.handle) || normalize(product.id)
  if (!key) return buildProductIntelligence(product)
  const cached = intelligenceCache.get(key)
  if (cached) return cached
  const built = buildProductIntelligence(product)
  intelligenceCache.set(key, built)
  if (intelligenceCache.size > MAX_CACHE_SIZE) {
    const oldest = intelligenceCache.keys().next().value
    if (oldest) intelligenceCache.delete(oldest)
  }
  return built
}
