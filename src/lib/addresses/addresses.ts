import addressesData from "@/assets/addresses/nested_clean_addresses.json"

export type CountryCode = string

export type CityIndexEntry = {
  countryCode: CountryCode
  provinceName: string
  cityName: string
  areas: string[]
}

export type CityOption = {
  id: string
  label: string
  countryCode: CountryCode
  provinceName: string
  cityName: string
}

export type AreaOption = {
  id: string
  label: string
}

type CountryOption = { id: CountryCode; label: string }

type RawAddresses = Record<string, Record<string, Record<string, string[] | undefined>>>

export function normalizeName(value: string | null | undefined) {
  if (!value) return ""
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildCityId(entry: { countryCode: CountryCode; provinceName: string; cityName: string }) {
  return `${entry.countryCode}|${entry.provinceName}|${entry.cityName}`
}

function buildAreaId(entry: { countryCode: CountryCode; provinceName: string; cityName: string }, area: string) {
  return `${entry.countryCode}|${entry.provinceName}|${entry.cityName}|${area}`
}

const countryOptions: CountryOption[] = []
const cityIndexByCountry: Record<CountryCode, CityIndexEntry[]> = {}
const cityLookupById: Record<string, CityIndexEntry> = {}
const cityOptionsByCountry: Record<CountryCode, CityOption[]> = {}

function hydrate(raw: RawAddresses) {
  Object.entries(raw).forEach(([countryCode, provinces]) => {
    const countryCities: CityIndexEntry[] = []

    Object.entries(provinces || {}).forEach(([provinceName, cities]) => {
      let provinceHasCity = false

      Object.entries(cities || {}).forEach(([cityName, rawAreas]) => {
        const areas = Array.isArray(rawAreas)
          ? rawAreas.map((area) => area?.toString().trim()).filter((area): area is string => !!area)
          : []

        if (areas.length === 0) return

        provinceHasCity = true

        const entry: CityIndexEntry = {
          countryCode,
          provinceName,
          cityName,
          areas,
        }

        const id = buildCityId(entry)
        cityLookupById[id] = entry
        countryCities.push(entry)
      })

      if (!provinceHasCity) {
        return
      }
    })

    if (countryCities.length > 0) {
      cityIndexByCountry[countryCode] = countryCities
    }
  })

  Object.keys(cityIndexByCountry)
    .sort((a, b) => a.localeCompare(b))
    .forEach((countryCode) => {
      countryOptions.push({ id: countryCode, label: countryCode })
      cityOptionsByCountry[countryCode] = cityIndexByCountry[countryCode]
        .map<CityOption>((entry) => ({
          id: buildCityId(entry),
          label: entry.cityName,
          countryCode: entry.countryCode,
          provinceName: entry.provinceName,
          cityName: entry.cityName,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    })
}

hydrate(addressesData as RawAddresses)

export function getAreaOptions(cityId: string | null | undefined): AreaOption[] {
  if (!cityId) return []
  const city = cityLookupById[cityId]
  if (!city) return []
  return city.areas.map<AreaOption>((area) => ({ id: buildAreaId(city, area), label: area }))
}

export { countryOptions, cityIndexByCountry, cityLookupById, cityOptionsByCountry }
