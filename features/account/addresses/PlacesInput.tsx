import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native"

import { usePlacesAutocomplete } from "./usePlacesAutocomplete"
import type { PlaceDetailsResult } from "@/lib/maps/places"
import { Input } from "@/ui/primitives/Input"

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

export function PlacesInput({ onPick, label = "Search for an address", placeholder = "Start typing an address" }: PlacesInputProps) {
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
      } catch {
        // errors are handled via the hook toast
      }
    },
    [onPick, pick, setQuery],
  )

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
        <View className="absolute left-0 right-0 z-10 mt-2 max-h-72 rounded-xl border border-[#CBD5E1] bg-white shadow-lg">
          {isLoading ? (
            <View className="flex-row items-center gap-2 px-4 py-3">
              <ActivityIndicator size="small" color="#111827" />
              <Text className="text-[13px] text-[#475569]">Searching…</Text>
            </View>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={suggestions}
              keyExtractor={(item) => item.placeId}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable onPress={() => handleSelect(item)} className="px-4 py-3 active:bg-[#F1F5F9]">
                  <Text className="text-[14px] text-[#0f172a] font-medium">{item.structuredFormatting?.main_text ?? item.description}</Text>
                  {!!item.structuredFormatting?.secondary_text && (
                    <Text className="text-[12px] text-[#64748b]">{item.structuredFormatting.secondary_text}</Text>
                  )}
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View className="h-px bg-[#E2E8F0]" />}
              ListFooterComponent={
                isFetchingDetails ? (
                  <View className="flex-row items-center gap-2 px-4 py-3">
                    <ActivityIndicator size="small" color="#111827" />
                    <Text className="text-[13px] text-[#475569]">Loading place…</Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>
      ) : null}
    </View>
  )
}
