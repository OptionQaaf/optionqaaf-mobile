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
const COUNTRY_LABELS: Record<CountryCode, string> = {
  KSA: "Saudi Arabia / السعودية",
  UAE: "United Arab Emirates / الإمارات",
  KWT: "Kuwait / الكويت",
  QAT: "Qatar / قطر",
  BHR: "Bahrain / البحرين",
  OMN: "Oman / عمان",
  JOR: "Jordan / الأردن",
  IRQ: "Iraq / العراق",
}
export const COUNTRY_DIAL_CODES: Record<CountryCode, string> = {
  KSA: "966",
  UAE: "971",
  KWT: "965",
  QAT: "974",
  BHR: "973",
  OMN: "968",
  JOR: "962",
  IRQ: "964",
}

export const COUNTRY_PHONE_LENGTHS: Record<CountryCode, number> = {
  KSA: 9,
  UAE: 9,
  KWT: 8,
  QAT: 8,
  BHR: 8,
  OMN: 8,
  JOR: 9,
  IRQ: 10,
}

function hydrate(raw: RawAddresses) {
  Object.entries(raw).forEach(([countryCode, provinces]) => {
    const countryCities: CityIndexEntry[] = []

    Object.entries(provinces || {}).forEach(([provinceName, cities]) => {
      let provinceHasCity = false

      Object.entries(cities || {}).forEach(([cityName, rawAreas]) => {
        const areas = Array.isArray(rawAreas)
          ? rawAreas.map((area) => area?.toString().trim()).filter((area): area is string => !!area)
          : []
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
      const label = COUNTRY_LABELS[countryCode] ?? countryCode
      countryOptions.push({ id: countryCode, label })
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
  if (city.areas.length === 0) {
    return [{ id: buildAreaId(city, city.cityName), label: city.cityName }]
  }
  return city.areas.map<AreaOption>((area) => ({ id: buildAreaId(city, area), label: area }))
}

export function normalizePhoneDigits(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "")
}

export function stripCountryDialCode(phoneNumber: string | null | undefined, countryCode: string | null): string {
  const digits = normalizePhoneDigits(phoneNumber)
  if (!digits) return ""
  const dial = countryCode ? COUNTRY_DIAL_CODES[countryCode.toUpperCase()] : undefined
  const withoutDial = dial && digits.startsWith(dial) ? digits.slice(dial.length) : digits
  return withoutDial.replace(/^0+/, "")
}

export function formatPhoneNumber(countryCode: string | null, localNumber: string): string {
  const digits = normalizePhoneDigits(localNumber).replace(/^0+/, "")
  if (!digits) return ""
  const dial = countryCode ? COUNTRY_DIAL_CODES[countryCode.toUpperCase()] : undefined
  if (!dial) return digits
  return `+${dial}${digits}`
}

export { countryOptions, cityIndexByCountry, cityLookupById, cityOptionsByCountry }
