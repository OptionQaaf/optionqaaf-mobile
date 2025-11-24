import type { GeocodedAddress } from "@/src/lib/addresses/mapMapper"

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY

if (!GOOGLE_PLACES_KEY) {
  throw new Error("Missing EXPO_PUBLIC_GOOGLE_PLACES_KEY")
}

export type PlaceSuggestion = {
  place_id: string
  description: string
  structured_formatting?: {
    main_text?: string
    secondary_text?: string
  }
}

export type PlaceDetailsResult = {
  coordinate: { latitude: number; longitude: number } | null
  address: GeocodedAddress
  formatted?: string
  name?: string
}

type GooglePrediction = {
  place_id: string
  description: string
  structured_formatting?: {
    main_text?: string
    secondary_text?: string
  }
}

type GoogleAddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

type GooglePlaceDetailsResponse = {
  status: string
  result?: {
    formatted_address?: string
    name?: string
    geometry?: { location?: { lat: number; lng: number } }
    address_components?: GoogleAddressComponent[]
  }
  error_message?: string
}

type GoogleAutocompleteResponse = {
  status: string
  predictions?: GooglePrediction[]
  error_message?: string
}

type GoogleGeocodeResponse = {
  status: string
  results?: Array<{
    formatted_address?: string
    geometry?: { location?: { lat: number; lng: number } }
    address_components?: GoogleAddressComponent[]
  }>
  error_message?: string
}

function buildParams(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.append(key, value)
  })
  return search
}

function parseAddressComponents(components: GoogleAddressComponent[] | undefined): GeocodedAddress {
  if (!components) return {}

  const find = (type: string) => components.find((component) => component.types.includes(type))

  const streetNumber = find("street_number")?.long_name ?? ""
  const route = find("route")?.long_name ?? ""
  const subpremise = find("subpremise")?.long_name ?? ""
  const locality = find("locality")?.long_name
  const postalTown = find("postal_town")?.long_name
  const adminLevel2 = find("administrative_area_level_2")?.long_name
  const adminLevel1 = find("administrative_area_level_1")
  const postalCode = find("postal_code")?.long_name
  const country = find("country")
  const neighborhood = find("neighborhood")?.long_name ?? find("sublocality")?.long_name

  const street = [streetNumber, route, subpremise].filter(Boolean).join(" ").trim()

  const rawCity = locality || postalTown || adminLevel2 || undefined
  const rawProvince = adminLevel1?.long_name || adminLevel1?.short_name
  const rawArea = neighborhood || undefined

  return {
    rawStreet: street || undefined,
    rawCity,
    rawProvince: rawProvince || undefined,
    rawZip: postalCode || undefined,
    rawCountryCode: country?.short_name || undefined,
    rawArea,
  }
}

async function handleGoogleError(response: Response) {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Google Places request failed: ${response.status}`)
  }
}

function validateStatus(status: string, errorMessage?: string) {
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    throw new Error(errorMessage || `Google Places request failed with status ${status}`)
  }
}

export async function placesAutocomplete(input: string, sessionToken: string, signal?: AbortSignal) {
  const params = buildParams({
    input,
    key: GOOGLE_PLACES_KEY,
    sessiontoken: sessionToken,
    types: "address",
  })

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`, {
    signal,
  })
  await handleGoogleError(response)
  const data = (await response.json()) as GoogleAutocompleteResponse
  validateStatus(data.status, data.error_message)
  return (data.predictions ?? []).map<PlaceSuggestion>((prediction) => ({
    place_id: prediction.place_id,
    description: prediction.description,
    structured_formatting: prediction.structured_formatting,
  }))
}

export async function placeDetails(
  placeId: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlaceDetailsResult> {
  const params = buildParams({
    place_id: placeId,
    key: GOOGLE_PLACES_KEY,
    sessiontoken: sessionToken,
    fields: "address_component,geometry/location,formatted_address,name",
  })

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`, {
    signal,
  })
  await handleGoogleError(response)
  const data = (await response.json()) as GooglePlaceDetailsResponse
  validateStatus(data.status, data.error_message)

  const result = data.result
  if (!result) {
    return { coordinate: null, address: {} }
  }

  const address = parseAddressComponents(result.address_components)
  const location = result.geometry?.location

  return {
    coordinate: location ? { latitude: location.lat, longitude: location.lng } : null,
    address,
    formatted: result.formatted_address,
    name: result.name,
  }
}

export async function reverseGeocodeGoogle(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<PlaceDetailsResult> {
  const params = buildParams({
    latlng: `${lat},${lng}`,
    key: GOOGLE_PLACES_KEY,
    result_type: "street_address|premise|subpremise|route",
  })

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, { signal })
  await handleGoogleError(response)
  const data = (await response.json()) as GoogleGeocodeResponse
  validateStatus(data.status, data.error_message)

  const result = data.results?.[0]
  if (!result) {
    return { coordinate: { latitude: lat, longitude: lng }, address: {} }
  }

  const address = parseAddressComponents(result.address_components)
  const location = result.geometry?.location ?? { lat, lng }

  return {
    coordinate: location ? { latitude: location.lat, longitude: location.lng } : null,
    address,
    formatted: result.formatted_address,
  }
}

export async function geocodeAddressString(address: string, signal?: AbortSignal): Promise<GeocodedAddress> {
  const params = buildParams({
    address,
    key: GOOGLE_PLACES_KEY,
  })

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, {
    signal,
  })
  await handleGoogleError(response)
  const data = (await response.json()) as GoogleGeocodeResponse
  validateStatus(data.status, data.error_message)

  const result = data.results?.[0]
  if (!result) return {}

  return parseAddressComponents(result.address_components)
}
