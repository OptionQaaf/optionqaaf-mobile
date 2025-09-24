export const qk = {
  plp: (handle: string, params: object) => ["plp", handle, params] as const,
  product: (handle: string, params?: object) => ["product", handle, params] as const,
  search: (query: string, params?: object) => ["search", query, params] as const,
  brandIndex: () => ["brands", "index"] as const,
  brandDetail: (vendor: string) => ["brands", vendor] as const,
  cart: (cartId: string | null) => ["cart", cartId] as const,
  collectionsSummary: (handles: string | string[], params?: object) => [
    "collections",
    "summary",
    handles,
    params,
  ] as const,
  customerOverview: () => ["customer", "overview"] as const,
  customerOrders: (params?: object) => ["customer", "orders", params] as const,
  customerAddresses: () => ["customer", "addresses"] as const,
}
