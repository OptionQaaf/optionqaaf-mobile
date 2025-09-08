import { getMobileHome, normalizeHome } from "@/lib/shopify/services/home"
import { currentLocale } from "@/store/prefs"
import { useQuery } from "@tanstack/react-query"

export function useMobileHome(handle = "app-home") {
  const { language } = currentLocale()
  return useQuery({
    queryKey: ["home", handle, language],
    queryFn: async () => normalizeHome(await getMobileHome(handle, language)),
  })
}
