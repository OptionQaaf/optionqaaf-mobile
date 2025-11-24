import assert from "node:assert/strict"
import test from "node:test"

import { cityLookupById } from "@/src/lib/addresses/addresses"
import { applyArea, applyCity, applyCountry, applyMappedSelection, createInitialAddressState } from "@/features/account/addresses/formState"

const sampleCityId = Object.keys(cityLookupById)[0]
const sampleCity = cityLookupById[sampleCityId]

const baseState = createInitialAddressState()

test("changing country resets city and area", () => {
  const withCountry = applyCountry({ ...baseState, cityId: sampleCityId, area: "Area" }, "KSA")
  assert.equal(withCountry.countryCode, "KSA")
  assert.equal(withCountry.cityId, null)
  assert.equal(withCountry.area, null)
  assert.equal(withCountry.provinceName, null)
})

test("changing city applies province and clears area", () => {
  const next = applyCity({ ...baseState, countryCode: "KSA", area: "Area" }, sampleCityId)
  assert.equal(next.cityId, sampleCityId)
  assert.equal(next.provinceName, sampleCity.provinceName)
  assert.equal(next.area, null)
})

test("mapped selection merges address line and zip", () => {
  const selection = applyMappedSelection(baseState, {
    countryCode: "KSA",
    provinceName: sampleCity.provinceName,
    cityId: sampleCityId,
    area: sampleCity.areas[0],
    addressLine: "123 Street",
    zip: "90001",
  })
  assert.equal(selection.addressLine, "123 Street")
  assert.equal(selection.zip, "90001")
  assert.equal(selection.countryCode, "KSA")
  assert.equal(selection.cityId, sampleCityId)
  assert.equal(selection.area, sampleCity.areas[0])
})

test("area update only changes area", () => {
  const withArea = applyArea({ ...baseState, countryCode: "KSA", cityId: sampleCityId, provinceName: sampleCity.provinceName }, "Test Area")
  assert.equal(withArea.area, "Test Area")
  assert.equal(withArea.countryCode, "KSA")
  assert.equal(withArea.cityId, sampleCityId)
})
