import type { CurrencyCode } from "./config"

// Approximate fixed rates relative to 1 USD.
// perUSD[code] = how many units of that currency per 1 USD.
// Example: 1 USD ≈ 3.75 SAR => perUSD.SAR = 3.75
const perUSD: Record<CurrencyCode, number> = {
  USD: 1,
  SAR: 3.75,
  AED: 3.6725,
  KWD: 0.308, // 1 USD ≈ 0.308 KWD
  QAR: 3.64,
  BHD: 0.376,
  OMR: 0.385,
}

export function convertAmount(amount: number, from: string, to: string): number {
  const f = (from?.toUpperCase?.() ?? "USD") as CurrencyCode
  const t = (to?.toUpperCase?.() ?? "USD") as CurrencyCode
  if (!perUSD[f] || !perUSD[t]) return amount
  if (f === t) return amount
  // amount in USD
  const inUSD = amount / perUSD[f]
  // amount in target units
  return inUSD * perUSD[t]
}

