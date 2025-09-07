import { getMenuByHandle, normalizeMenu } from "@/lib/shopify/services/menus"
import { currentLocale } from "@/store/prefs"
import { useQuery } from "@tanstack/react-query"

export function useMenu(handle: string) {
  const { language } = currentLocale()
  return useQuery({
    queryKey: ["menu", handle, language],
    queryFn: async () => normalizeMenu(await getMenuByHandle(handle, language)),
  })
}
