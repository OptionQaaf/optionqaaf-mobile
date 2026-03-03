export type BirthDateValue = string

const BIRTH_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function birthDateFromDate(date: Date): BirthDateValue {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

export function birthDateToDate(value: BirthDateValue | null | undefined): Date | null {
  if (!isBirthDateValue(value)) return null
  const [yearRaw, monthRaw, dayRaw] = value.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const day = Number(dayRaw)
  const parsed = new Date(year, monthIndex, day)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function isBirthDateValue(value: unknown): value is BirthDateValue {
  if (typeof value !== "string") return false
  const match = value.match(BIRTH_DATE_RE)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return false
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return false

  return value <= birthDateFromDate(new Date())
}

export function getDefaultBirthDateSelection(): Date {
  const now = new Date()
  return new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
}
