export type MoneyV2 = { amount: string; currencyCode: string }

export function formatMoney(m: MoneyV2 | null | undefined, opts?: Intl.NumberFormatOptions & { currency?: string }) {
  if (!m) return "—"
  const currency = opts?.currency ?? m.currencyCode
  const n = Number(m.amount)
  if (!Number.isFinite(n)) return "—"
  return new Intl.NumberFormat(undefined, { style: "currency", currency, ...opts }).format(n)
}
