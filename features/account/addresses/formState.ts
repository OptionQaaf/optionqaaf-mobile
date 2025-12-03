import { cityLookupById } from "@/src/lib/addresses/addresses"
import type { MappedAddressSelection } from "@/src/lib/addresses/mapMapper"

export type AddressFormState = {
  firstName: string
  lastName: string
  company: string
  phoneNumber: string
  addressLine: string
  address2: string
  countryCode: string | null
  provinceName: string | null
  cityId: string | null
  area: string | null
  zip: string
  saudiPostNumber: string
  defaultAddress: boolean
}

export function createInitialAddressState(initialValues?: Partial<AddressFormState>): AddressFormState {
  return {
    firstName: initialValues?.firstName ?? "",
    lastName: initialValues?.lastName ?? "",
    company: initialValues?.company ?? "",
    phoneNumber: initialValues?.phoneNumber ?? "",
    addressLine: initialValues?.addressLine ?? "",
    address2: initialValues?.address2 ?? "",
    countryCode: initialValues?.countryCode ?? null,
    provinceName: initialValues?.provinceName ?? null,
    cityId: initialValues?.cityId ?? null,
    area: initialValues?.area ?? null,
    zip: initialValues?.zip ?? "",
    saudiPostNumber: initialValues?.saudiPostNumber ?? "",
    defaultAddress: initialValues?.defaultAddress ?? false,
  }
}

export function applyCountry(state: AddressFormState, countryCode: string | null): AddressFormState {
  return {
    ...state,
    countryCode,
    provinceName: null,
    cityId: null,
    area: null,
    saudiPostNumber: countryCode === "KSA" ? state.saudiPostNumber : "",
  }
}

export function applyCity(state: AddressFormState, cityId: string | null): AddressFormState {
  if (!cityId) {
    return { ...state, cityId: null, provinceName: null, area: null }
  }
  const city = cityLookupById[cityId]
  return {
    ...state,
    cityId,
    provinceName: city?.provinceName ?? null,
    area: null,
  }
}

export function applyArea(state: AddressFormState, area: string | null): AddressFormState {
  return { ...state, area }
}

export function applyMappedSelection(
  state: AddressFormState,
  selection: MappedAddressSelection | null | undefined,
): AddressFormState {
  if (!selection) return state
  let next = state
  if (selection.countryCode) {
    next = applyCountry(next, selection.countryCode)
  }
  if (selection.cityId) {
    next = applyCity(next, selection.cityId)
  }
  if (selection.area !== undefined) {
    next = applyArea(next, selection.area)
  }
  return {
    ...next,
    provinceName: selection.provinceName ?? next.provinceName,
    addressLine: selection.addressLine ?? next.addressLine,
    zip: selection.zip ?? next.zip,
  }
}
