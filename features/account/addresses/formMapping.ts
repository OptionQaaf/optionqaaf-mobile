import {
  cityLookupById,
  formatPhoneNumber,
  normalizeName,
  stripCountryDialCode,
} from "@/src/lib/addresses/addresses"
import { COUNTRY_MAP, mapGeocodedAddressToSelection } from "@/src/lib/addresses/mapMapper"
import type { CustomerAddress } from "@/lib/shopify/customer/profile"
import type { CustomerAddressInput } from "@/lib/shopify/customer/addresses"
import type { AddressFormSubmitData } from "./AddressForm"
import type { AddressFormState } from "./formState"

const TERRITORY_CODE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_MAP).map(([territoryCode, datasetCode]) => [datasetCode, territoryCode]),
)

type AddressMetadata = {
  latitude?: number
  longitude?: number
  nationalAddressCode?: string
}

export const ADDRESS_METADATA_PREFIX = "__META:"

function encodeAddressMetadata({
  latitude,
  longitude,
  nationalAddressCode,
}: AddressMetadata): string | null {
  const hasLatLng = typeof latitude === "number" && typeof longitude === "number"
  const hasNationalAddress =
    typeof nationalAddressCode === "string" && nationalAddressCode.trim().length > 0
  if (!hasLatLng && !hasNationalAddress) return null

  const payload: AddressMetadata = {}
  if (hasLatLng) {
    payload.latitude = Number(latitude.toFixed(6))
    payload.longitude = Number(longitude.toFixed(6))
  }
  if (hasNationalAddress) {
    payload.nationalAddressCode = nationalAddressCode.trim()
  }

  try {
    return `${ADDRESS_METADATA_PREFIX}${JSON.stringify(payload)}`
  } catch {
    return null
  }
}

function parseAddressMetadata(part: string | undefined): AddressMetadata | null {
  if (!part || !part.startsWith(ADDRESS_METADATA_PREFIX)) return null
  const raw = part.slice(ADDRESS_METADATA_PREFIX.length)
  try {
    const parsed = JSON.parse(raw)
    return {
      latitude: typeof parsed.latitude === "number" ? parsed.latitude : undefined,
      longitude: typeof parsed.longitude === "number" ? parsed.longitude : undefined,
      nationalAddressCode:
        typeof parsed.nationalAddressCode === "string"
          ? parsed.nationalAddressCode
          : typeof parsed.saudiPostNumber === "string"
            ? parsed.saudiPostNumber
            : undefined,
    }
  } catch {
    return null
  }
}

function resolveTerritoryCode(code: string | null): string | null {
  if (!code) return null
  const normalized = code.trim().toUpperCase()
  return TERRITORY_CODE_MAP[normalized] ?? normalized
}

const KUWAIT_ZONE_CODE_MAP: Record<string, string> = {
  "al ahmadi": "AH",
  ahmadi: "AH",
  "al farwaniyah": "FA",
  farwaniyah: "FA",
  hawalli: "HA",
  "al jahra": "JA",
  jahra: "JA",
  "al asimah": "KU",
  "al assima": "KU",
  kuwait: "KU",
  "mubarak al kabeer": "MU",
  "mubarak al kabeer governorate": "MU",
  "mubarak al-kabeer": "MU",
}

function resolveZoneCode(countryCode: string | null, provinceName: string | null): string | null {
  if (!provinceName) return null
  const normalizedCountry = countryCode?.trim().toUpperCase() ?? ""
  if (normalizedCountry === "KWT") {
    const normalizedProvince = normalizeName(provinceName)
    const cleaned = normalizedProvince.replace(/\bgovernorate\b|\bgovernate\b/g, "").replace(/\s+/g, " ").trim()
    return KUWAIT_ZONE_CODE_MAP[cleaned] ?? KUWAIT_ZONE_CODE_MAP[normalizedProvince] ?? null
  }
  return provinceName
}

function splitAddress2(address2?: string | null): {
  rawArea?: string
  address2Value: string
  metadata?: AddressMetadata
} {
  const cleaned = address2?.trim()
  if (!cleaned) return { rawArea: undefined, address2Value: "", metadata: undefined }

  const parts = cleaned.split("•").map((part) => part.trim()).filter(Boolean)
  const metadataParts = parts.filter((part) => part.startsWith(ADDRESS_METADATA_PREFIX))
  const metadata = parseAddressMetadata(metadataParts[0]) ?? undefined
  const nonMetaParts = parts.filter((part) => !part.startsWith(ADDRESS_METADATA_PREFIX))
  if (nonMetaParts.length <= 1) {
    return { rawArea: undefined, address2Value: nonMetaParts.join(" • "), metadata }
  }

  const [maybeArea, ...rest] = nonMetaParts
  return {
    rawArea: maybeArea || undefined,
    address2Value: rest.join(" • ").trim(),
    metadata,
  }
}

export function formToInput(values: AddressFormSubmitData): CustomerAddressInput {
  const cityEntry = values.cityId ? cityLookupById[values.cityId] : undefined
  const provinceName = values.provinceName ?? cityEntry?.provinceName ?? null
  const cityName = cityEntry?.cityName ?? null
  const countryCode = values.countryCode ?? null
  const addressLine = values.addressLine.trim() || null
  const address2 = values.address2.trim() || null
  const metadata = encodeAddressMetadata({
    latitude: values.__coordinate?.lat,
    longitude: values.__coordinate?.lng,
    nationalAddressCode: countryCode === "KSA" ? values.saudiNationalAddressCode : undefined,
  })
  const address2WithArea = [values.area, address2, metadata].filter(Boolean).join(" • ") || null
  const territoryCode = resolveTerritoryCode(countryCode)
  const datasetCountryCode =
    countryCode && TERRITORY_CODE_MAP[countryCode.trim().toUpperCase()]
      ? TERRITORY_CODE_MAP[countryCode.trim().toUpperCase()]
      : countryCode
  const phoneNumber = formatPhoneNumber(datasetCountryCode ?? null, values.phoneNumber)
  const zoneCode = resolveZoneCode(countryCode, provinceName)

  return {
    firstName: values.firstName.trim() || null,
    lastName: values.lastName.trim() || null,
    company: values.company.trim() || null,
    phoneNumber: phoneNumber || null,
    address1: addressLine,
    address2: address2WithArea,
    city: cityName,
    zip: values.zip.trim() || null,
    zoneCode,
    territoryCode,
  }
}

export function buildInitialValuesFromAddress(
  address: CustomerAddress | null | undefined,
  isDefault?: boolean,
): Partial<AddressFormState> & { __coordinate?: { lat: number; lng: number } } {
  if (!address) return { defaultAddress: Boolean(isDefault) }

  const { rawArea, address2Value, metadata } = splitAddress2(address.address2)
  const selection = mapGeocodedAddressToSelection({
    rawCountryCode: address.territoryCode ?? address.country ?? undefined,
    rawProvince: address.zoneCode ?? address.province ?? undefined,
    rawCity: address.city ?? undefined,
    rawArea: rawArea ?? address.address2 ?? undefined,
    rawStreet: address.address1 ?? undefined,
    rawZip: address.zip ?? undefined,
  })
  const phoneCountry = selection.countryCode ?? address.territoryCode ?? address.country ?? null
  const normalizedPhoneCountry =
    phoneCountry && COUNTRY_MAP[phoneCountry.toUpperCase()]
      ? COUNTRY_MAP[phoneCountry.toUpperCase()]
      : phoneCountry

  return {
    firstName: address.firstName ?? "",
    lastName: address.lastName ?? "",
    company: address.company ?? "",
    phoneNumber: stripCountryDialCode(address.phoneNumber ?? "", normalizedPhoneCountry),
    addressLine: address.address1 ?? selection.addressLine ?? "",
    address2: address2Value ?? "",
    countryCode: selection.countryCode ?? address.territoryCode ?? null,
    provinceName: selection.provinceName ?? address.zoneCode ?? address.province ?? null,
    cityId: selection.cityId ?? null,
    area: selection.area ?? null,
    zip: address.zip ?? selection.zip ?? "",
    saudiNationalAddressCode: metadata?.nationalAddressCode ?? "",
    __coordinate:
      metadata?.latitude && metadata?.longitude
        ? { lat: metadata.latitude, lng: metadata.longitude }
        : undefined,
    defaultAddress: Boolean(isDefault),
  }
}

export function stripAddressMetadata(address2?: string | null): string | null {
  if (!address2) return address2 ?? null
  const { address2Value, rawArea } = splitAddress2(address2)
  return [rawArea, address2Value].filter(Boolean).join(" • ") || null
}
