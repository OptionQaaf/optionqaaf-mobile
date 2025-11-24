import { geocodeAddressString, reverseGeocodeGoogle } from "@/lib/maps/places"
import {
  cityLookupById,
  cityOptionsByCountry,
  countryOptions,
  getAreaOptions,
  type AreaOption,
  type CityOption,
} from "@/src/lib/addresses/addresses"
import {
  mapGeocodedAddressToSelection,
  type GeocodedAddress,
  type MappedAddressSelection,
} from "@/src/lib/addresses/mapMapper"
import { useToast } from "@/ui/feedback/Toast"
import { Button } from "@/ui/primitives/Button"
import { Dropdown } from "@/ui/primitives/Dropdown"
import { Input } from "@/ui/primitives/Input"
import { Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import * as Location from "expo-location"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Platform, Switch, View } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"
import type { MapPressEvent, Region } from "react-native-maps"
import {
  applyArea,
  applyCity,
  applyCountry,
  applyMappedSelection,
  createInitialAddressState,
  type AddressFormState,
} from "./formState"

let ReactNativeMapsModule: typeof import("react-native-maps") | undefined
let reactNativeMapsError: unknown
try {
  ReactNativeMapsModule = require("react-native-maps")
} catch (error) {
  reactNativeMapsError = error
  if (__DEV__) {
    console.warn(
      "react-native-maps native module is unavailable. Run `pnpm expo prebuild` and use a dev client or EAS build.",
      error,
    )
  }
}

export type AddressFormSubmitData = AddressFormState & {
  __coordinate?: { lat: number; lng: number }
}

type AddressFormProps = {
  initialValues?: Partial<AddressFormState> & { __coordinate?: { lat: number; lng: number } }
  isSubmitting?: boolean
  submitLabel: string
  onSubmit: (data: AddressFormSubmitData) => void
  onDelete?: () => void
}

type FormErrors = Partial<Record<keyof AddressFormState, string>>

type Coordinate = { latitude: number; longitude: number }

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
}

export function AddressForm({ initialValues, isSubmitting, submitLabel, onSubmit, onDelete }: AddressFormProps) {
  const { show } = useToast()
  const initialCoordinate = initialValues?.__coordinate
  const mapModule = ReactNativeMapsModule
  const MapViewComponent = mapModule?.default
  const MarkerComponent = mapModule?.Marker
  const [values, setValues] = useState<AddressFormState>(() => createInitialAddressState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})
  const zipEditedManually = useRef(false)
  const [region, setRegion] = useState<Region>(() =>
    initialCoordinate
      ? {
          latitude: initialCoordinate.lat,
          longitude: initialCoordinate.lng,
          latitudeDelta: DEFAULT_REGION.latitudeDelta,
          longitudeDelta: DEFAULT_REGION.longitudeDelta,
        }
      : DEFAULT_REGION,
  )
  const [selectedCoordinate, setSelectedCoordinate] = useState<Coordinate | null>(() =>
    initialCoordinate ? { latitude: initialCoordinate.lat, longitude: initialCoordinate.lng } : null,
  )
  const [geo, setGeo] = useState<{ lat: number; lng: number } | undefined>(initialCoordinate)
  const [isLocating, setIsLocating] = useState(false)

  useEffect(() => {
    if (!initialValues) return
    const { __coordinate, ...rest } = initialValues
    setValues((prev) => ({ ...prev, ...createInitialAddressState(rest) }))
    if (__coordinate) {
      const coordinate = { latitude: __coordinate.lat, longitude: __coordinate.lng }
      setSelectedCoordinate(coordinate)
      setGeo({ lat: coordinate.latitude, lng: coordinate.longitude })
      setRegion((prev) => ({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: prev.latitudeDelta ?? DEFAULT_REGION.latitudeDelta,
        longitudeDelta: prev.longitudeDelta ?? DEFAULT_REGION.longitudeDelta,
      }))
    }
  }, [initialValues])

  const updateValue = useCallback(<K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateCoordinateState = useCallback((coordinate: Coordinate | null) => {
    setSelectedCoordinate(coordinate)
    setGeo(coordinate ? { lat: coordinate.latitude, lng: coordinate.longitude } : undefined)
  }, [])

  const setRegionForCoordinate = useCallback((coordinate: Coordinate) => {
    setRegion((prev) => ({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: prev.latitudeDelta ?? DEFAULT_REGION.latitudeDelta,
      longitudeDelta: prev.longitudeDelta ?? DEFAULT_REGION.longitudeDelta,
    }))
  }, [])

  const ensurePermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== "granted") {
      show({ title: "Location permission is required to use the map", type: "danger" })
      throw new Error("Permission not granted")
    }
  }, [show])

  const applySelection = useCallback((selection: MappedAddressSelection | null | undefined) => {
    if (selection?.zip) {
      zipEditedManually.current = false
    }
    setValues((prev) => applyMappedSelection(prev, selection))
  }, [])

  const applyGeocodedAddress = useCallback(
    (address: GeocodedAddress | undefined) => {
      if (!address) return
      applySelection(mapGeocodedAddressToSelection(address))
    },
    [applySelection],
  )

  const reverseGeocode = useCallback(
    async (coordinate: Coordinate) => {
      try {
        setIsLocating(true)
        try {
          const result = await reverseGeocodeGoogle(coordinate.latitude, coordinate.longitude)
          applyGeocodedAddress(result.address)
          return
        } catch (error) {
          console.error("reverseGeocodeGoogle", error)
        }

        try {
          const results = await Location.reverseGeocodeAsync(coordinate)
          const best = results[0]
          if (best) {
            const streetParts = [best.streetNumber, best.street || best.name].filter(Boolean)
            const fallbackAddress: GeocodedAddress = {
              rawStreet: streetParts.join(" "),
              rawCity: best.city ?? best.subregion ?? undefined,
              rawProvince: best.region ?? best.subregion ?? undefined,
              rawZip: best.postalCode ?? undefined,
              rawCountryCode: best.isoCountryCode ?? undefined,
              rawArea: best.district ?? best.subregion ?? undefined,
            }
            applyGeocodedAddress(fallbackAddress)
            return
          }
        } catch (error) {
          console.error("expo reverseGeocode", error)
        }

        show({ title: "Could not look up that location", type: "danger" })
      } catch (error) {
        console.error("reverseGeocode", error)
        show({ title: "Could not look up that location", type: "danger" })
      } finally {
        setIsLocating(false)
      }
    },
    [applyGeocodedAddress, show],
  )

  const handleMapPress = useCallback(
    async (event: MapPressEvent) => {
      const coordinate = event.nativeEvent.coordinate
      updateCoordinateState(coordinate)
      setRegionForCoordinate(coordinate)
      try {
        await ensurePermission()
        await reverseGeocode(coordinate)
      } catch {
        /* handled */
      }
    },
    [ensurePermission, reverseGeocode, setRegionForCoordinate, updateCoordinateState],
  )

  const handleUseCurrentLocation = useCallback(async () => {
    try {
      setIsLocating(true)
      await ensurePermission()
      const position = await Location.getCurrentPositionAsync({})
      const coordinate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }
      setRegionForCoordinate(coordinate)
      updateCoordinateState(coordinate)
      await reverseGeocode(coordinate)
    } catch (error) {
      show({ title: "Could not fetch your current location", type: "danger" })
    } finally {
      setIsLocating(false)
    }
  }, [ensurePermission, reverseGeocode, setRegionForCoordinate, show, updateCoordinateState])

  const submit = useCallback(() => {
    const nextErrors: FormErrors = {}

    if (!values.firstName.trim()) nextErrors.firstName = "First name is required"
    if (!values.lastName.trim()) nextErrors.lastName = "Last name is required"
    if (!values.addressLine.trim()) nextErrors.addressLine = "Street address is required"
    if (!values.countryCode?.trim()) nextErrors.countryCode = "Country is required"
    if (!values.cityId?.trim()) nextErrors.cityId = "City is required"
    if (!values.zip.trim()) nextErrors.zip = "Postal code is required"

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      show({ title: "Check the highlighted fields", type: "danger" })
      return
    }

    onSubmit({
      ...values,
      __coordinate: geo,
    })
  }, [geo, onSubmit, show, values])

  const mapRegion = useMemo(() => region, [region])
  const mapUnavailableMessage = useMemo(() => {
    if (MapViewComponent) return undefined
    if (Platform.OS === "web") {
      return "The map preview is not available on the web preview. Use the mobile dev client instead."
    }
    if (reactNativeMapsError) {
      return "Map preview unavailable. Install the dev client (pnpm expo prebuild && pnpm expo run) to enable the native map."
    }
    return "Map preview unavailable on this device. Use the Option QAAF dev client or an EAS build to drop a pin."
  }, [MapViewComponent, reactNativeMapsError])

  const cityOptions = useMemo<CityOption[]>(() => {
    if (!values.countryCode) return []
    return cityOptionsByCountry[values.countryCode] ?? []
  }, [values.countryCode])

  const areaOptions = useMemo<AreaOption[]>(() => getAreaOptions(values.cityId), [values.cityId])

  const cityName = values.cityId ? cityLookupById[values.cityId]?.cityName : undefined

  useEffect(() => {
    if (!values.countryCode || !values.cityId || !values.addressLine.trim()) return
    const city = cityLookupById[values.cityId]
    if (!city) return
    if (zipEditedManually.current && !values.zip.trim()) {
      zipEditedManually.current = false
    }
    if (zipEditedManually.current) return

    const parts = [
      values.addressLine,
      values.address2,
      values.area,
      city.cityName,
      city.provinceName,
      values.countryCode,
    ]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
    if (!parts.length) return

    const query = parts.join(", ")
    const controller = new AbortController()
    const timer = setTimeout(() => {
      geocodeAddressString(query, controller.signal)
        .then((address) => {
          if (!address.rawZip || zipEditedManually.current) return
          setValues((prev) => ({ ...prev, zip: address.rawZip ?? prev.zip }))
        })
        .catch((error) => {
          if (error?.name === "AbortError") return
          console.error("geocodeAddressString", error)
        })
    }, 500)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [
    values.address2,
    values.addressLine,
    values.area,
    values.cityId,
    values.countryCode,
    values.provinceName,
    values.zip,
  ])

  return (
    <KeyboardAwareScrollView
      enableOnAndroid
      extraScrollHeight={40}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
      className="bg-[#f8fafc]"
    >
      <View className="gap-6 px-5 pt-6 pb-10">
        <Card padding="lg" className="gap-4">
          <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Contact</Text>
          <View className="gap-3">
            <Input
              label="First name"
              value={values.firstName}
              onChangeText={(text) => updateValue("firstName", text)}
              error={errors.firstName}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Input
              label="Last name"
              value={values.lastName}
              onChangeText={(text) => updateValue("lastName", text)}
              error={errors.lastName}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Input
              label="Company (optional)"
              value={values.company}
              onChangeText={(text) => updateValue("company", text)}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Input
              label="Phone number"
              value={values.phoneNumber}
              onChangeText={(text) => updateValue("phoneNumber", text)}
              keyboardType="phone-pad"
              placeholder="+16135551111"
              returnKeyType="next"
            />
          </View>
        </Card>

        <Card padding="lg" className="gap-4">
          <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Address</Text>
          <View className="gap-3">
            <View className="gap-3">
              <Text className="text-[#0f172a] font-geist-semibold text-[15px]">Pin the address</Text>
              <View className="h-64 w-full overflow-hidden rounded-2xl bg-[#e2e8f0]">
                {MapViewComponent ? (
                  <MapViewComponent
                    style={{ flex: 1 }}
                    region={mapRegion}
                    onRegionChangeComplete={setRegion}
                    onPress={handleMapPress}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                    {...(Platform.OS === "android" && mapModule?.PROVIDER_GOOGLE
                      ? { provider: mapModule.PROVIDER_GOOGLE }
                      : {})}
                  >
                    {selectedCoordinate && MarkerComponent ? (
                      <MarkerComponent
                        coordinate={selectedCoordinate}
                        draggable
                        onDragEnd={(event) => {
                          const coordinate = event.nativeEvent.coordinate
                          updateCoordinateState(coordinate)
                          setRegionForCoordinate(coordinate)
                          reverseGeocode(coordinate).catch(() => {
                            /* handled */
                          })
                        }}
                      />
                    ) : null}
                  </MapViewComponent>
                ) : (
                  <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-center text-[#475569] text-[13px] leading-[18px]">
                      {mapUnavailableMessage}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-[#64748b] text-[13px] leading-[18px]">
                Tap on the map to drop a pin or use your current location. We’ll fill in as many address fields as we
                can.
              </Text>
              <Button variant="outline" onPress={handleUseCurrentLocation} isLoading={isLocating}>
                Use current location
              </Button>
            </View>
            <Input
              label="Address line"
              value={values.addressLine}
              onChangeText={(text) => updateValue("addressLine", text)}
              error={errors.addressLine}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Input
              label="Address line 2 (optional)"
              value={values.address2}
              onChangeText={(text) => updateValue("address2", text)}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Dropdown
              label="Country"
              value={values.countryCode ?? undefined}
              options={countryOptions}
              onChange={(code) => setValues((prev) => applyCountry(prev, code))}
              hasError={!!errors.countryCode}
              searchable
              placeholder="Select a country"
            />
            {errors.countryCode ? <Text className="text-[12px] text-[#ef4444]">{errors.countryCode}</Text> : null}
            <Dropdown
              label="City"
              value={values.cityId ?? undefined}
              options={cityOptions}
              onChange={(cityId) => setValues((prev) => applyCity(prev, cityId))}
              hasError={!!errors.cityId}
              searchable
              placeholder={values.countryCode ? "Select a city" : "Choose a country first"}
              disabled={!values.countryCode}
            />
            {errors.cityId ? <Text className="text-[12px] text-[#ef4444]">{errors.cityId}</Text> : null}
            <Dropdown
              label="Area"
              value={values.area ? `${values.cityId}|${values.area}` : undefined}
              options={areaOptions.map((option) => ({ id: option.id, label: option.label }))}
              onChange={(areaId) => {
                const option = areaOptions.find((opt) => opt.id === areaId)
                setValues((prev) => applyArea(prev, option?.label ?? null))
              }}
              searchable
              placeholder={values.cityId ? "Select an area" : "Choose a city first"}
              disabled={!values.cityId}
            />
            <Input
              label="Postal code"
              value={values.zip}
              onChangeText={(text) => {
                zipEditedManually.current = text.trim().length > 0
                updateValue("zip", text)
              }}
              error={errors.zip}
              autoCapitalize="characters"
              returnKeyType="done"
            />
          </View>
        </Card>

        <Card padding="lg" className="gap-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Set as default</Text>
              <Text className="text-[#64748b] text-[13px] leading-[18px]">
                Orders and quick checkouts will use this address automatically.
              </Text>
            </View>
            <Switch
              value={values.defaultAddress}
              onValueChange={(val) => updateValue("defaultAddress", val)}
              trackColor={{ true: "#111827", false: "#cbd5f5" }}
              thumbColor="#ffffff"
            />
          </View>
        </Card>

        <View className="gap-3">
          <Button onPress={submit} isLoading={isSubmitting}>
            {submitLabel}
          </Button>
          {onDelete ? (
            <Button variant="outline" onPress={onDelete} disabled={isSubmitting}>
              Delete address
            </Button>
          ) : null}
        </View>
      </View>
    </KeyboardAwareScrollView>
  )
}
