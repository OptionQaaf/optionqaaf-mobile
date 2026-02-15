import assert from "node:assert/strict"
import test from "node:test"

import { buildProductIntelligence, getCachedProductIntelligence } from "@/features/catalog/intelligence"
import { inferPrimaryCategory } from "@/features/for-you/category"
import {
  applyForYouEvent,
  createEmptyForYouProfile,
  type ForYouCandidate,
  type RankedForYouItem,
} from "@/features/for-you/profile"
import { dedupeForYouCandidates, getSeedTermSet, rankForYouReelCandidates } from "@/features/for-you/reelService"
import { selectForYouPageFromRankedList } from "@/features/for-you/service"

function candidate(handle: string, title: string, extra: Partial<ForYouCandidate> = {}): ForYouCandidate {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    title,
    vendor: "brand-a",
    productType: "",
    tags: ["women"],
    createdAt: "2026-02-10T00:00:00Z",
    availableForSale: true,
    ...extra,
  }
}

test("inferPrimaryCategory prioritizes denim and underwear correctly", () => {
  assert.equal(inferPrimaryCategory(candidate("blue-denim-jeans", "Blue Denim Jeans")), "bottoms_denim")
  assert.equal(inferPrimaryCategory(candidate("cotton-boxer", "Cotton Boxer Brief")), "underwear")
})

test("getSeedTermSet filters generic/gender terms", () => {
  const seed = candidate("new-women-denim-jeans", "New Denim Jeans", {
    tags: ["women", "new", "denim"],
  })
  const terms = getSeedTermSet({ ...seed, descriptionHtml: "<p>new arrivals women denim</p>" })
  assert.equal(terms.seedTerms.includes("women"), false)
  assert.equal(terms.seedTerms.includes("new"), false)
  assert.ok(terms.seedTerms.includes("denim"))
})

test("buildProductIntelligence extracts category and attributes", () => {
  const intelligence = buildProductIntelligence(
    candidate("washed-denim-jeans", "Washed Slim Denim Jeans", {
      productType: "Jeans",
      tags: ["women", "vintage", "casual"],
      featuredImage: { url: "https://cdn.shopify.com/denim_washed_blue_front.jpg", altText: "Slim fit blue denim" },
    }),
  )
  assert.equal(intelligence.primaryCategory, "bottoms_denim")
  assert.ok(intelligence.materialTokens.includes("denim"))
  assert.ok(intelligence.fitTokens.includes("slim"))
  assert.ok(intelligence.colorTokens.includes("blue"))
})

test("getCachedProductIntelligence reuses cached object for same handle", () => {
  const product = candidate("cache-denim", "Cache Denim Jeans")
  const a = getCachedProductIntelligence(product)
  const b = getCachedProductIntelligence(product)
  assert.equal(a, b)
})

test("rankForYouReelCandidates keeps seed-consistent categories ahead", () => {
  let profile = createEmptyForYouProfile("2026-02-10T00:00:00Z")
  profile = applyForYouEvent(profile, { type: "product_open", handle: "blue-denim-jeans", vendor: "brand-a" })

  const seed = candidate("blue-denim-jeans", "Blue Denim Jeans", { productType: "jeans", tags: ["women", "denim"] })
  const denim = candidate("dark-denim-jeans", "Dark Denim Jeans", { productType: "jeans", tags: ["women", "denim"] })
  const boxer = candidate("soft-boxer", "Soft Boxer Brief", { productType: "underwear", tags: ["women", "underwear"] })

  const ranked = rankForYouReelCandidates(seed, [boxer, denim], profile, {
    seedTerms: ["denim", "jeans"],
    seedPrimaryCategory: "bottoms_denim",
    page: 0,
    includeDebug: true,
  })
  assert.equal(ranked[0]?.handle, "dark-denim-jeans")
  assert.ok((ranked.find((entry) => entry.handle === "soft-boxer") as any)?.__debug?.categoryPenalty > 0)
})

test("selectForYouPageFromRankedList is deterministic for same seed and varies with refresh seed", () => {
  const ranked: RankedForYouItem[] = Array.from({ length: 80 }).map((_, idx) => ({
    ...candidate(`item-${idx}`, `Item ${idx}`, {
      vendor: `vendor-${idx % 5}`,
      tags: ["women", idx % 2 === 0 ? "denim" : "tops"],
    }),
    __score: 100 - idx,
  }))

  const a = selectForYouPageFromRankedList(ranked, 20, {
    pageDepth: 0,
    explorationRatio: 0.1,
    seed: "profile|refresh-1|en",
  })
  const b = selectForYouPageFromRankedList(ranked, 20, {
    pageDepth: 0,
    explorationRatio: 0.1,
    seed: "profile|refresh-1|en",
  })
  const c = selectForYouPageFromRankedList(ranked, 20, {
    pageDepth: 0,
    explorationRatio: 0.1,
    seed: "profile|refresh-2|en",
  })

  assert.deepEqual(
    a.items.map((item) => item.handle),
    b.items.map((item) => item.handle),
  )
  assert.notDeepEqual(
    a.items.map((item) => item.handle),
    c.items.map((item) => item.handle),
  )
})

test("dedupeForYouCandidates removes duplicate handles", () => {
  const input = [
    candidate("same-handle", "One", { id: "gid://shopify/Product/1" }),
    candidate("same-handle", "Two", { id: "gid://shopify/Product/2" }),
    candidate("other-handle", "Three", { id: "gid://shopify/Product/3" }),
  ]
  const deduped = dedupeForYouCandidates(input)
  assert.equal(deduped.items.length, 2)
  assert.equal(deduped.deduped, 1)
})
