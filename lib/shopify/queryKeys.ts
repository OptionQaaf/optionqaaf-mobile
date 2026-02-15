export const qk = {
  plp: (handle: string, params: object) => ["plp", handle, params] as const,
  product: (handle: string, params?: object) => ["product", handle, params] as const,
  search: (query: string, params?: object) => ["search", query, params] as const,
  brandIndex: () => ["brands", "index"] as const,
  brandDetail: (vendor: string) => ["brands", vendor] as const,
  cart: (cartId: string | null) => ["cart", cartId] as const,
  collectionsSummary: (handles: string | string[], params?: object) =>
    ["collections", "summary", handles, params] as const,
  customerProfile: () => ["customer", "profile"] as const,
  customerOrders: (pageSize: number) => ["customer", "orders", pageSize] as const,
  customerOrder: (orderId: string) => ["customer", "order", orderId] as const,
  forYou: {
    profile: (locale: { country?: string; language?: string }, customerId?: string | null) =>
      ["for-you", "profile", locale, customerId ?? "guest"] as const,
    products: (
      locale: { country?: string; language?: string },
      gender: string,
      profileHash: string,
      pageSize: number,
      cursor?: string | null,
      refreshKey?: number,
    ) => ["for-you", "products", locale, gender, profileHash, pageSize, cursor ?? null, refreshKey ?? 0] as const,
  },
}
