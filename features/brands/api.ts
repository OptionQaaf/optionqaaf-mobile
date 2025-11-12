import { qk } from "@/lib/shopify/queryKeys"
import { getAllBrands, getBrandPreview } from "@/lib/shopify/services/brands"
import { kv } from "@/lib/storage/mmkv"
import { currentLocale } from "@/store/prefs"
import { useQuery } from "@tanstack/react-query"

const BRAND_CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

type CachePayload = {
  timestamp: number
  brands: Awaited<ReturnType<typeof getAllBrands>>
}

function brandCacheKey(locale: ReturnType<typeof currentLocale>) {
  const lang = locale.language ?? "unknown"
  const country = locale.country ?? "unknown"
  return `brands:index:${lang}:${country}`
}

function readCache(key: string) {
  try {
    const raw = kv.get(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachePayload
    if (!parsed?.timestamp || !Array.isArray(parsed.brands)) return null
    if (Date.now() - parsed.timestamp > BRAND_CACHE_TTL) return null
    return parsed.brands
  } catch {
    return null
  }
}

function writeCache(key: string, brands: Awaited<ReturnType<typeof getAllBrands>>) {
  try {
    const payload: CachePayload = { timestamp: Date.now(), brands }
    kv.set(key, JSON.stringify(payload))
  } catch {
    // no-op; cache is best-effort
  }
}

export function useBrandIndex() {
  const locale = currentLocale()
  return useQuery({
    queryKey: [...qk.brandIndex(), locale.language, locale.country],
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const key = brandCacheKey(locale)
      const cached = readCache(key)
      if (cached) return cached
      const fresh = await getAllBrands(locale)
      writeCache(key, fresh)
      return fresh
    },
  })
}

export function useBrandPreview(vendor?: string | null) {
  const locale = currentLocale()
  return useQuery({
    queryKey: ["brand-preview", vendor, locale.language, locale.country],
    enabled: Boolean(vendor),
    staleTime: 1000 * 60 * 5,
    queryFn: () => getBrandPreview(vendor ?? "", locale),
  })
}
