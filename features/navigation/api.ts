import { getMenuByHandle, normalizeMenu } from "@/lib/shopify/services/menus"
import { useQuery } from "@tanstack/react-query"

const qk = {
  menu: (handle: string) => ["menu", handle] as const,
}

export function useMenu(handle: string) {
  return useQuery({
    queryKey: qk.menu(handle),
    queryFn: async () => normalizeMenu(await getMenuByHandle(handle)),
    enabled: Boolean(handle),
    placeholderData: (prev) => prev, // keep previous on refetch
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    select: (data) => (Array.isArray(data) ? data : []),
  })
}
