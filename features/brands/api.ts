import { LocalePrefs } from "@/lib/shopify/env"

export type Brand = { name: string; handle: string }
export async function getAllBrandsMvp(_locale?: LocalePrefs): Promise<Brand[]> {
  // Placeholder: replace with a small server function or precomputed list.
  return []
}
