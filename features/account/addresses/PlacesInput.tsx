import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native"

import type { PlaceDetailsResult } from "@/lib/maps/places"
import { Input } from "@/ui/primitives/Input"
import { usePlacesAutocomplete } from "./usePlacesAutocomplete"

export type PlacePick = {
  placeId: string
  description: string
  details?: PlaceDetailsResult | null
}

type PlacesInputProps = {
  onPick: (value: PlacePick) => void | Promise<void>
  label?: string
  placeholder?: string
}

export function PlacesInput({
  onPick,
  label = "Search for an address",
  placeholder = "Start typing an address",
}: PlacesInputProps) {
  const { query, setQuery, suggestions, isLoading, isFetchingDetails, pick } = usePlacesAutocomplete()
  const [isFocused, setIsFocused] = useState(false)

  const shouldShowDropdown = useMemo(() => {
    if (!isFocused) return false
    if (query.trim().length < 3) return false
    return suggestions.length > 0 || isLoading
  }, [isFocused, isLoading, query, suggestions.length])

  const handleSelect = useCallback(
    async (item: (typeof suggestions)[number]) => {
      setQuery(item.description)
      setIsFocused(false)
      try {
        const details = await pick(item.placeId)
        onPick({ placeId: item.placeId, description: item.description, details })
      } catch {}
    },
    [onPick, pick, setQuery],
  )

  const INPUT_HEIGHT = 72

  return (
    <View className="relative">
      <Input
        label={label}
        placeholder={placeholder}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />

      {shouldShowDropdown ? (
        <View
          style={{ position: "absolute", left: 0, right: 0, top: INPUT_HEIGHT }}
          className="z-10 max-h-72 overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-lg"
        >
          {isLoading ? (
            <View className="flex-row items-center gap-2 px-4 py-3">
              <ActivityIndicator size="small" color="#111827" />
              <Text className="text-[13px] text-[#475569]">Searching…</Text>
            </View>
          ) : (
            <View style={{ maxHeight: 288 }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 288 }}
              >
                {suggestions.map((item, idx) => (
                  <Pressable
                    key={item.placeId}
                    onPress={async () => await handleSelect(item)}
                    className="px-4 py-3 active:bg-[#F1F5F9]"
                  >
                    <Text className="text-[14px] text-[#0f172a] font-medium">
                      {item.structuredFormatting?.main_text ?? item.description}
                    </Text>
                    {!!item.structuredFormatting?.secondary_text && (
                      <Text className="text-[12px] text-[#64748b]">{item.structuredFormatting.secondary_text}</Text>
                    )}
                    {idx < suggestions.length - 1 && <View className="h-px mt-2 bg-[#E2E8F0]" />}
                  </Pressable>
                ))}
              </ScrollView>
              {isFetchingDetails && (
                <View className="flex-row items-center gap-2 px-4 py-3">
                  <ActivityIndicator size="small" color="#111827" />
                  <Text className="text-[13px] text-[#475569]">Loading place…</Text>
                </View>
              )}
            </View>
          )}
        </View>
      ) : null}
    </View>
  )
}
