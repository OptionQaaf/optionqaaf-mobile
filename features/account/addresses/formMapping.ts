import { cityLookupById } from "@/src/lib/addresses/addresses"
import { COUNTRY_MAP, mapGeocodedAddressToSelection } from "@/src/lib/addresses/mapMapper"
import type { CustomerAddress } from "@/lib/shopify/customer/profile"
import type { CustomerAddressInput } from "@/lib/shopify/customer/addresses"
import type { AddressFormSubmitData } from "./AddressForm"
import type { AddressFormState } from "./formState"

const TERRITORY_CODE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_MAP).map(([territoryCode, datasetCode]) => [datasetCode, territoryCode]),
)

function resolveTerritoryCode(code: string | null): string | null {
  if (!code) return null
  const normalized = code.trim().toUpperCase()
  return TERRITORY_CODE_MAP[normalized] ?? normalized
}

function splitAddress2(address2?: string | null): { rawArea?: string; address2Value: string } {
  const cleaned = address2?.trim()
  if (!cleaned) return { rawArea: undefined, address2Value: "" }

  const parts = cleaned.split("•").map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 1) {
    return { rawArea: undefined, address2Value: cleaned }
  }

  const [maybeArea, ...rest] = parts
  return {
    rawArea: maybeArea || undefined,
    address2Value: rest.join(" • ").trim(),
  }
}

export function formToInput(values: AddressFormSubmitData): CustomerAddressInput {
  const cityEntry = values.cityId ? cityLookupById[values.cityId] : undefined
  const provinceName = values.provinceName ?? cityEntry?.provinceName ?? null
  const cityName = cityEntry?.cityName ?? null
  const countryCode = values.countryCode ?? null
  const addressLine = values.addressLine.trim() || null
  const address2 = values.address2.trim() || null
  const address2WithArea = [values.area, address2].filter(Boolean).join(" • ") || null
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
): Partial<AddressFormState> {
  if (!address) return { defaultAddress: Boolean(isDefault) }

  const { rawArea, address2Value } = splitAddress2(address.address2)
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
    defaultAddress: Boolean(isDefault),
  }
}
