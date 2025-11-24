import assert from "node:assert/strict"
import test from "node:test"

import {
  cityIndexByCountry,
  cityLookupById,
  cityOptionsByCountry,
  countryOptions,
  getAreaOptions,
  normalizeName,
} from "@/src/lib/addresses/addresses"

test("filters invalid provinces and cities", () => {
  const ksaCities = cityIndexByCountry["KSA"] ?? []
  assert.equal(
    ksaCities.some((entry) => entry.provinceName.toLowerCase() === "cess"),
    false,
    "Should not include invalid province entries",
  )
  assert.ok(ksaCities.length > 0, "Should keep valid KSA cities")
})

test("builds country and area options", () => {
  assert.ok(countryOptions.find((option) => option.id === "KSA"), "Includes KSA in countries")
  const firstCityId = Object.keys(cityLookupById)[0]
  const areas = getAreaOptions(firstCityId)
  assert.ok(areas.length > 0, "Areas populated for known city")
})

test("city options align with lookup", () => {
  const ksaCity = cityOptionsByCountry["KSA"]?.[0]
  assert.ok(ksaCity, "KSA should have at least one city option")
  const lookup = ksaCity ? cityLookupById[ksaCity.id] : undefined
  assert.ok(lookup && lookup.cityName === ksaCity?.cityName)
})

test("normalizeName trims and strips diacritics", () => {
  const raw = "  Ál Riyāḑ  "
  const normalized = normalizeName(raw)
  assert.equal(normalized, "al riyad")
})
