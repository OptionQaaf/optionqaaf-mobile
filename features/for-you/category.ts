import { getCachedProductIntelligence, type PrimaryCategory } from "@/features/catalog/intelligence"
import type { ForYouCandidate } from "@/features/for-you/profile"

export type { PrimaryCategory }

export function inferPrimaryCategory(
  product: Pick<ForYouCandidate, "handle" | "title" | "vendor" | "productType" | "tags">,
): PrimaryCategory {
  const intelligence = getCachedProductIntelligence({
    id: product.handle || product.title || "unknown",
    handle: product.handle,
    title: product.title ?? null,
    vendor: product.vendor ?? null,
    productType: product.productType ?? null,
    tags: product.tags ?? null,
  })
  return intelligence.primaryCategory as PrimaryCategory
}
