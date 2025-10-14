import { useToast } from "@/ui/feedback/Toast"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { placeDetails, placesAutocomplete, type PlaceDetailsResult, type PlaceSuggestion } from "@/lib/maps/places"

function createSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export type AutocompleteSuggestion = {
  placeId: string
  description: string
  structuredFormatting?: PlaceSuggestion["structured_formatting"]
}

export function usePlacesAutocomplete() {
  const { show } = useToast()
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingDetails, setIsFetchingDetails] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const sessionTokenRef = useRef<string>(createSessionToken())
  const detailsAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed.length < 3) {
      abortRef.current?.abort()
      setSuggestions([])
      setIsLoading(false)
      return
    }

    const handler = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsLoading(true)

      placesAutocomplete(trimmed, sessionTokenRef.current, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) {
            setSuggestions(
              results.map((item) => ({
                placeId: item.place_id,
                description: item.description,
                structuredFormatting: item.structured_formatting,
              })),
            )
          }
        })
        .catch((error) => {
          if ((error as any)?.name === "AbortError") return
          console.error("placesAutocomplete", error)
          show({ title: "Could not load address suggestions", type: "danger" })
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false)
          }
        })
    }, 250)

    return () => {
      clearTimeout(handler)
    }
  }, [query, show])

  const clearSuggestions = useCallback(() => {
    abortRef.current?.abort()
    setSuggestions([])
    setIsLoading(false)
  }, [])

  const pick = useCallback(
    async (placeId: string): Promise<PlaceDetailsResult | null> => {
      if (!placeId) return null
      setIsFetchingDetails(true)
      detailsAbortRef.current?.abort()
      const controller = new AbortController()
      detailsAbortRef.current = controller
      try {
        const details = await placeDetails(placeId, sessionTokenRef.current, controller.signal)
        sessionTokenRef.current = createSessionToken()
        clearSuggestions()
        return details
      } catch (error: any) {
        if (error?.name === "AbortError") return null
        console.error("placeDetails", error)
        show({ title: "Could not load that place", type: "danger" })
        throw error
      } finally {
        if (detailsAbortRef.current === controller) {
          detailsAbortRef.current = null
        }
        setIsFetchingDetails(false)
      }
    },
    [clearSuggestions, show],
  )

  const state = useMemo(
    () => ({
      query,
      setQuery,
      suggestions,
      isLoading,
      isFetchingDetails,
      pick,
      clearSuggestions,
    }),
    [clearSuggestions, isFetchingDetails, isLoading, pick, query, suggestions],
  )

  return state
}
