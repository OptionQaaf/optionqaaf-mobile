export type CurrencyCode = "USD" | "SAR" | "AED" | "KWD" | "QAR" | "BHD" | "OMR"

export type CurrencyInfo = {
  code: CurrencyCode
  label: string
  flag: string
  symbol: string
}

// Supported currencies with flags and symbols for quick display
export const CURRENCIES: CurrencyInfo[] = [
  { code: "SAR", label: "Saudi Riyal", flag: "🇸🇦", symbol: "﷼" },
  { code: "AED", label: "UAE Dirham", flag: "🇦🇪", symbol: "د.إ" },
  { code: "KWD", label: "Kuwaiti Dinar", flag: "🇰🇼", symbol: "د.ك" },
  { code: "QAR", label: "Qatari Riyal", flag: "🇶🇦", symbol: "ر.ق" },
  { code: "BHD", label: "Bahraini Dinar", flag: "🇧🇭", symbol: "ب.د" },
  { code: "OMR", label: "Omani Rial", flag: "🇴🇲", symbol: "ر.ع" },
  { code: "USD", label: "US Dollar", flag: "🇺🇸", symbol: "$" },
]

export const CURRENCIES_MAP: Record<CurrencyCode, CurrencyInfo> = CURRENCIES.reduce(
  (acc, c) => {
    acc[c.code] = c
    return acc
  },
  {} as Record<CurrencyCode, CurrencyInfo>,
)

