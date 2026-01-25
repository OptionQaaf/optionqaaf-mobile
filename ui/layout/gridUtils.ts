export function padToFullRow<T>(items: T[], columns: number) {
  if (columns <= 1) return items
  const remainder = items.length % columns
  if (remainder === 0) return items
  const fillerCount = columns - remainder
  const fillers = Array.from({ length: fillerCount }, () => null) as (T | null)[]
  return [...items, ...fillers]
}
