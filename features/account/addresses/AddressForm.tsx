import { placeDetails, reverseGeocodeGoogle } from "@/lib/maps/places"
import { useToast } from "@/ui/feedback/Toast"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import * as Location from "expo-location"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Platform, ScrollView, Switch, View } from "react-native"
import type { MapPressEvent, Region } from "react-native-maps"
import { PlacesInput, type PlacePick } from "./PlacesInput"

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

export type AddressFormData = {
  firstName: string
  lastName: string
  company: string
  phoneNumber: string
  address1: string
  address2: string
  city: string
  zoneCode: string
  territoryCode: string
  zip: string
  defaultAddress: boolean
}

export type AddressFormSubmitData = AddressFormData & {
  __coordinate?: { lat: number; lng: number }
}

type AddressFormProps = {
  initialValues?: Partial<AddressFormData> & { __coordinate?: { lat: number; lng: number } }
  isSubmitting?: boolean
  submitLabel: string
  onSubmit: (data: AddressFormSubmitData) => void
  onDelete?: () => void
}

type FormErrors = Partial<Record<keyof AddressFormData, string>>

type Coordinate = { latitude: number; longitude: number }

function createPlacesSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

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
  const [values, setValues] = useState<AddressFormData>(() => ({
    firstName: initialValues?.firstName ?? "",
    lastName: initialValues?.lastName ?? "",
    company: initialValues?.company ?? "",
    phoneNumber: initialValues?.phoneNumber ?? "",
    address1: initialValues?.address1 ?? "",
    address2: initialValues?.address2 ?? "",
    city: initialValues?.city ?? "",
    zoneCode: initialValues?.zoneCode ?? "",
    territoryCode: initialValues?.territoryCode ?? "",
    zip: initialValues?.zip ?? "",
    defaultAddress: initialValues?.defaultAddress ?? false,
  }))
  const [errors, setErrors] = useState<FormErrors>({})
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
    setValues((prev) => ({
      ...prev,
      ...rest,
      defaultAddress: initialValues?.defaultAddress ?? prev.defaultAddress,
    }))
  }, [initialValues])

  useEffect(() => {
    if (!initialCoordinate) return
    const coordinate = { latitude: initialCoordinate.lat, longitude: initialCoordinate.lng }
    setSelectedCoordinate(coordinate)
    setGeo({ lat: coordinate.latitude, lng: coordinate.longitude })
    setRegion((prev) => ({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: prev.latitudeDelta ?? DEFAULT_REGION.latitudeDelta,
      longitudeDelta: prev.longitudeDelta ?? DEFAULT_REGION.longitudeDelta,
    }))
  }, [initialCoordinate])

  const updateValue = useCallback(<K extends keyof AddressFormData>(key: K, value: AddressFormData[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const applyAddress = useCallback(
    (address: Partial<AddressFormData> | undefined) => {
      if (!address) return
      const entries = Object.entries(address) as Array<
        [keyof AddressFormData, AddressFormData[keyof AddressFormData] | undefined]
      >
      entries.forEach(([key, value]) => {
        if (value !== undefined) {
          let nextValue: AddressFormData[keyof AddressFormData] = value
          if (key === "territoryCode" && typeof value === "string") {
            nextValue = value.toUpperCase() as AddressFormData[keyof AddressFormData]
          }
          updateValue(key, nextValue as AddressFormData[keyof AddressFormData])
        }
      })
    },
    [updateValue],
  )

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

  const reverseGeocode = useCallback(
    async (coordinate: Coordinate) => {
      try {
        setIsLocating(true)
        try {
          const result = await reverseGeocodeGoogle(coordinate.latitude, coordinate.longitude)
          applyAddress(result.address)
          return
        } catch (error) {
          console.error("reverseGeocodeGoogle", error)
        }

        try {
          const results = await Location.reverseGeocodeAsync(coordinate)
          const best = results[0]
          if (best) {
            const streetParts = [best.streetNumber, best.street || best.name].filter(Boolean)
            applyAddress({
              address1: streetParts.join(" "),
              city: best.city ?? best.subregion ?? "",
              zoneCode: best.region ?? best.subregion ?? "",
              zip: best.postalCode ?? "",
              territoryCode: best.isoCountryCode ?? "",
            })
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
    [applyAddress, show],
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

  const handlePickPlace = useCallback(
    async ({ placeId, details }: PlacePick) => {
      if (!placeId && !details) return
      setIsLocating(true)
      try {
        const place = details ?? (placeId ? await placeDetails(placeId, createPlacesSessionToken()) : undefined)
        if (!place) return
        applyAddress(place.address)
        if (place.coordinate) {
          updateCoordinateState(place.coordinate)
          setRegionForCoordinate(place.coordinate)
        }
      } catch (error) {
        console.error("handlePickPlace", error)
        show({ title: "Could not load that place", type: "danger" })
      } finally {
        setIsLocating(false)
      }
    },
    [applyAddress, setRegionForCoordinate, show, updateCoordinateState],
  )

  const submit = useCallback(() => {
    const nextErrors: FormErrors = {}

    if (!values.firstName.trim()) nextErrors.firstName = "First name is required"
    if (!values.lastName.trim()) nextErrors.lastName = "Last name is required"
    if (!values.address1.trim()) nextErrors.address1 = "Street address is required"
    if (!values.city.trim()) nextErrors.city = "City is required"
    if (!values.territoryCode.trim()) nextErrors.territoryCode = "Country code is required"
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

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }} className="bg-[#f8fafc]">
      <View className="gap-6 px-5 pt-6 pb-10">
        <Card padding="lg" className="gap-4">
          <View className="gap-3">
            <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Pin the address</Text>
            <PlacesInput onPick={handlePickPlace} />
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
                  <Text className="text-center text-[#475569] text-[13px] leading-[18px]">{mapUnavailableMessage}</Text>
                </View>
              )}
            </View>
            <Text className="text-[#64748b] text-[13px] leading-[18px]">
              Tap on the map to drop a pin or use your current location. We’ll fill in as many address fields as we can.
            </Text>
            <Button variant="outline" onPress={handleUseCurrentLocation} isLoading={isLocating}>
              Use current location
            </Button>
          </View>
        </Card>

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
            <Input
              label="Address line 1"
              value={values.address1}
              onChangeText={(text) => updateValue("address1", text)}
              error={errors.address1}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Input
              label="Address line 2"
              value={values.address2}
              onChangeText={(text) => updateValue("address2", text)}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Input
              label="City"
              value={values.city}
              onChangeText={(text) => updateValue("city", text)}
              error={errors.city}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Input
              label="State / Province"
              value={values.zoneCode}
              onChangeText={(text) => updateValue("zoneCode", text)}
              autoCapitalize="characters"
              returnKeyType="next"
            />
            <Input
              label="Country code"
              value={values.territoryCode}
              onChangeText={(text) => updateValue("territoryCode", text.toUpperCase())}
              error={errors.territoryCode}
              autoCapitalize="characters"
              maxLength={3}
              returnKeyType="next"
            />
            <Input
              label="Postal code"
              value={values.zip}
              onChangeText={(text) => updateValue("zip", text)}
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
    </ScrollView>
  )
}
