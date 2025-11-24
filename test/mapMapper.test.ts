import assert from "node:assert/strict"
import test from "node:test"

import { cityLookupById } from "@/src/lib/addresses/addresses"
import { mapGeocodedAddressToSelection } from "@/src/lib/addresses/mapMapper"

test("maps ISO country and city to structured selection", () => {
  const selection = mapGeocodedAddressToSelection({
    rawCountryCode: "SA",
    rawProvince: "Northern Region",
    rawCity: "Harmah",
    rawArea: "Harmah",
    rawStreet: "123 King St",
    rawZip: "11111",
  })

  assert.equal(selection.countryCode, "KSA")
  assert.ok(selection.cityId)
  const city = selection.cityId ? cityLookupById[selection.cityId] : undefined
  assert.ok(city)
  assert.equal(city?.provinceName, "Northern Region")
  assert.equal(selection.area, "Harmah")
  assert.equal(selection.addressLine, "123 King St")
  assert.equal(selection.zip, "11111")
})

test("fuzzy matches close city names", () => {
  const selection = mapGeocodedAddressToSelection({
    rawCountryCode: "SA",
    rawProvince: "Northern Region",
    rawCity: "Harma",
  })

  assert.equal(selection.countryCode, "KSA")
  assert.ok(selection.cityId, "City should be inferred with fuzzy matching")
})
