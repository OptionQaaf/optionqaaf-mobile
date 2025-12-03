import { cityIndexByCountry, cityLookupById, normalizeName, type CountryCode } from "./addresses"

export type GeocodedAddress = {
  rawCountryCode?: string
  rawProvince?: string
  rawCity?: string
  rawArea?: string
  rawStreet?: string
  rawZip?: string
  lat?: number
  lng?: number
}

export type MappedAddressSelection = {
  countryCode: string | null
  provinceName: string | null
  cityId: string | null
  area: string | null
  addressLine?: string | null
  zip?: string | null
}

export const COUNTRY_MAP: Record<string, CountryCode> = {
  SA: "KSA",
  AE: "UAE",
  KW: "KWT",
  BH: "BHR",
  QA: "QAT",
  OM: "OMN",
  JO: "JOR",
  IQ: "IRQ",
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0
  if (a === b) return 1
  const matrix: number[][] = []
  const aLen = a.length
  const bLen = b.length

  for (let i = 0; i <= bLen; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= aLen; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
      }
    }
  }

  const distance = matrix[bLen][aLen]
  return 1 - distance / Math.max(aLen, bLen)
}

function resolveCountry(rawCountryCode?: string | null): CountryCode | null {
  if (!rawCountryCode) return null
  const trimmed = rawCountryCode.trim()
  const upper = trimmed.toUpperCase()
  if (COUNTRY_MAP[upper]) return COUNTRY_MAP[upper]
  if (cityIndexByCountry[upper]) return upper

  const normalized = normalizeName(trimmed)
  const match = Object.keys(cityIndexByCountry).find((code) => normalizeName(code) === normalized)
  return match ?? null
}

function chooseCity(countryCode: CountryCode, rawCity?: string | null, rawProvince?: string | null) {
  const entries = cityIndexByCountry[countryCode] ?? []
  if (!entries.length) return null

  const normalizedCity = normalizeName(rawCity)
  const normalizedProvince = normalizeName(rawProvince)

  if (normalizedCity) {
    const exactMatches = entries.filter((entry) => normalizeName(entry.cityName) === normalizedCity)
    if (exactMatches.length === 1) return exactMatches[0]
    if (exactMatches.length > 1 && normalizedProvince) {
      const narrowed = exactMatches.find((entry) => normalizeName(entry.provinceName) === normalizedProvince)
      if (narrowed) return narrowed
    }
  }

  if (normalizedProvince) {
    const provinceMatches = entries.filter((entry) => normalizeName(entry.provinceName) === normalizedProvince)
    if (provinceMatches.length === 1) return provinceMatches[0]
  }

  if (normalizedCity) {
    const best = entries
      .map((entry) => ({
        entry,
        score: similarity(normalizeName(entry.cityName), normalizedCity),
        provinceScore: normalizedProvince ? similarity(normalizeName(entry.provinceName), normalizedProvince) : 0,
      }))
      .filter(({ score }) => score > 0.8)
      .sort((a, b) => {
        if (b.score === a.score) return b.provinceScore - a.provinceScore
        return b.score - a.score
      })
    if (best.length > 0) return best[0].entry
  }

  return null
}

function chooseArea(cityId: string, rawArea?: string | null) {
  if (!rawArea) return null
  const city = cityLookupById[cityId]
  if (!city) return null
  const normalizedArea = normalizeName(rawArea)
  const exact = city.areas.find((area) => normalizeName(area) === normalizedArea)
  if (exact) return exact

  const candidates = city.areas
    .map((area) => ({ area, score: similarity(normalizeName(area), normalizedArea) }))
    .filter(({ score }) => score > 0.8)
    .sort((a, b) => b.score - a.score)

  return candidates[0]?.area ?? null
}

export function mapGeocodedAddressToSelection(geo: GeocodedAddress): MappedAddressSelection {
  const countryCode = resolveCountry(geo.rawCountryCode)
  const cityEntry = countryCode ? chooseCity(countryCode, geo.rawCity, geo.rawProvince) : null
  const cityId = cityEntry ? `${cityEntry.countryCode}|${cityEntry.provinceName}|${cityEntry.cityName}` : null
  const area = cityId ? chooseArea(cityId, geo.rawArea) : null

  return {
    countryCode,
    provinceName: cityEntry?.provinceName ?? null,
    cityId,
    area,
    addressLine: geo.rawStreet ?? null,
    zip: geo.rawZip ?? null,
  }
}
