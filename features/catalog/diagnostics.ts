import { getCachedProductIntelligence, type IntelligenceProduct } from "@/features/catalog/intelligence"

export function logCatalogQualityMetrics(products: IntelligenceProduct[]): void {
  if (!(typeof __DEV__ !== "undefined" && __DEV__)) return
  const total = products.length
  if (!total) return

  let emptyProductType = 0
  let totalTags = 0
  let unknownCategory = 0
  const categories = new Map<string, number>()

  for (const product of products) {
    if (!String(product.productType ?? "").trim()) emptyProductType += 1
    totalTags += product.tags?.length ?? 0
    const intelligence = getCachedProductIntelligence(product)
    const category = intelligence.primaryCategory || "unknown"
    if (category === "unknown") unknownCategory += 1
    categories.set(category, (categories.get(category) ?? 0) + 1)
  }

  const distribution = Array.from(categories.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }))

  console.debug("[catalog][quality]", {
    total,
    emptyProductTypePct: Number(((emptyProductType / total) * 100).toFixed(2)),
    avgTagCount: Number((totalTags / total).toFixed(2)),
    unknownCategoryPct: Number(((unknownCategory / total) * 100).toFixed(2)),
    categoryDistribution: distribution,
  })
}
