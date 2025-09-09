import type { CurrencyCode } from "@/features/currency/config"

export type CountryCode = "SA" | "AE" | "KW" | "QA" | "BH" | "OM"

export type CountryInfo = {
  id: CountryCode
  label: string
  flag: string
  currency: CurrencyCode
}

export const COUNTRIES: CountryInfo[] = [
  { id: "SA", label: "Saudi Arabia / السعودية", flag: "🇸🇦", currency: "SAR" },
  { id: "AE", label: "United Arab Emirates / الإمارات", flag: "🇦🇪", currency: "AED" },
  { id: "KW", label: "Kuwait / الكويت", flag: "🇰🇼", currency: "KWD" },
  { id: "QA", label: "Qatar / قطر", flag: "🇶🇦", currency: "QAR" },
  { id: "BH", label: "Bahrain / البحرين", flag: "🇧🇭", currency: "BHD" },
  { id: "OM", label: "Oman / عمان", flag: "🇴🇲", currency: "OMR" },
]

