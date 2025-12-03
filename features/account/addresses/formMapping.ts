import { cityLookupById } from "@/src/lib/addresses/addresses"
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
  saudiPostNumber?: string
}

export const ADDRESS_METADATA_PREFIX = "__META:"

function encodeAddressMetadata({
  latitude,
  longitude,
  saudiPostNumber,
}: AddressMetadata): string | null {
  const hasLatLng = typeof latitude === "number" && typeof longitude === "number"
  const hasPost = typeof saudiPostNumber === "string" && saudiPostNumber.trim().length > 0
  if (!hasLatLng && !hasPost) return null

  const payload: AddressMetadata = {}
  if (hasLatLng) {
    payload.latitude = Number(latitude.toFixed(6))
    payload.longitude = Number(longitude.toFixed(6))
  }
  if (hasPost) {
    payload.saudiPostNumber = saudiPostNumber.trim()
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
      saudiPostNumber: typeof parsed.saudiPostNumber === "string" ? parsed.saudiPostNumber : undefined,
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
    saudiPostNumber: countryCode === "KSA" ? values.saudiPostNumber : undefined,
  })
  const address2WithArea = [values.area, address2, metadata].filter(Boolean).join(" • ") || null
  const territoryCode = resolveTerritoryCode(countryCode)

  return {
    firstName: values.firstName.trim() || null,
    lastName: values.lastName.trim() || null,
    company: values.company.trim() || null,
    phoneNumber: values.phoneNumber.trim() || null,
    address1: addressLine,
    address2: address2WithArea,
    city: cityName,
    zip: values.zip.trim() || null,
    zoneCode: provinceName,
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

  return {
    firstName: address.firstName ?? "",
    lastName: address.lastName ?? "",
    company: address.company ?? "",
    phoneNumber: address.phoneNumber ?? "",
    addressLine: address.address1 ?? selection.addressLine ?? "",
    address2: address2Value ?? "",
    countryCode: selection.countryCode ?? address.territoryCode ?? null,
    provinceName: selection.provinceName ?? address.zoneCode ?? address.province ?? null,
    cityId: selection.cityId ?? null,
    area: selection.area ?? null,
    zip: address.zip ?? selection.zip ?? "",
    saudiPostNumber: metadata?.saudiPostNumber ?? "",
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
