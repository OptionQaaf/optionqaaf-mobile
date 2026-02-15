const MAX_HTML_CHARS = 12000
const MAX_TEXT_CHARS = 6000
const MAX_SIGNAL_TERMS = 28

const STOPWORDS = new Set([
  "and",
  "for",
  "with",
  "the",
  "this",
  "that",
  "from",
  "your",
  "our",
  "you",
  "are",
  "was",
  "were",
  "women",
  "woman",
  "female",
  "men",
  "man",
  "male",
  "unisex",
  "product",
  "products",
])

function normalizeText(value?: string | null): string {
  if (typeof value !== "string") return ""
  return value.trim().toLowerCase()
}

function tokenize(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3 && !STOPWORDS.has(entry) && !/^\d+$/.test(entry))
}

function toBigrams(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length - 1; i += 1) {
    out.push(`${tokens[i]}_${tokens[i + 1]}`)
  }
  return out
}

function stripHtmlToText(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ")
  return withoutTags.replace(/\s+/g, " ").trim()
}

function extractImgAttributes(html: string, attribute: "alt" | "src"): string[] {
  const out: string[] = []
  const re = new RegExp(`<img\\b[^>]*\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "gi")
  let match: RegExpExecArray | null = re.exec(html)
  while (match) {
    const value = normalizeText(match[1] ?? match[2] ?? match[3] ?? "")
    if (value) out.push(value)
    match = re.exec(html)
  }
  return out
}

function normalizeSrcToTerms(src: string): string[] {
  const compact = src.split("?")[0]
  const segments = compact.split("/")
  const last = normalizeText(segments[segments.length - 1] ?? "")
  if (!last) return []
  const withoutExt = last.replace(/\.[a-z0-9]{2,5}$/i, "")
  return tokenize(withoutExt)
}

export function extractForYouContentSignals(input: {
  descriptionHtml?: string | null
  description?: string | null
  imageAltTexts?: (string | null | undefined)[] | null
  handle?: string | null
  title?: string | null
  vendor?: string | null
  productType?: string | null
}): string[] {
  const terms: string[] = []
  const pushTokens = (value?: string | null) => {
    const normalized = normalizeText(value)
    if (!normalized) return
    const tokens = tokenize(normalized)
    terms.push(...tokens, ...toBigrams(tokens))
  }

  const html = normalizeText(input.descriptionHtml).slice(0, MAX_HTML_CHARS)
  if (html) {
    const altTexts = extractImgAttributes(html, "alt")
    for (const alt of altTexts) pushTokens(alt)

    const srcValues = extractImgAttributes(html, "src")
    for (const src of srcValues) terms.push(...normalizeSrcToTerms(src))

    pushTokens(stripHtmlToText(html).slice(0, MAX_TEXT_CHARS))
  }

  pushTokens(input.description)
  pushTokens(input.handle)
  pushTokens(input.title)
  pushTokens(input.vendor)
  pushTokens(input.productType)
  for (const alt of input.imageAltTexts ?? []) {
    pushTokens(alt)
  }

  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of terms) {
    const key = normalizeText(entry)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
    if (out.length >= MAX_SIGNAL_TERMS) break
  }
  return out
}
