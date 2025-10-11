# 🧱 OptionQaaf Shopify Mobile App – Developer Reference

This is your personal reference for understanding, scaling, and maintaining the Shopify-powered mobile app you built
with Expo, React Query, GraphQL Codegen, and more.

---

## ✅ Core Architecture Overview

### 🧠 Data Flow

```
Screen (useProduct)
→ React Query (cache)
→ Service (getProductByHandle)
→ GraphQL client (shopifyClient.request)
→ Shopify Storefront GraphQL
→ JSON response (typed via codegen)
→ Back to your UI
```

---

## 🔌 Packages Used

| Package                                                | Purpose                       |
| ------------------------------------------------------ | ----------------------------- |
| `graphql`                                              | Base GraphQL tools            |
| `@graphql-codegen/cli`                                 | Codegen for types             |
| `graphql-request`                                      | Lightweight GraphQL client    |
| `@tanstack/react-query`                                | Fetching, caching, pagination |
| `zustand`                                              | Global state (prefs, cartId)  |
| `react-native-mmkv`                                    | Persistent local storage      |
| `expo-router`                                          | File-based navigation         |
| `dotenv`                                               | Load env for codegen          |
| `@react-native-async-storage/async-storage` (optional) | Expo Go fallback for MMKV     |

---

## 📦 Folder Structure (Simplified)

```
lib/
  ├── customerAuth/       # Discovery, OAuth/PKCE, session persistence
  ├── customerApi/        # Customer Account GraphQL client + operations
  └── shopify/            # Storefront API client and generated documents
      
features/
  └── product/api.ts
  └── cart/api.ts
  └── recommendations/api.ts

store/
  └── prefs.ts
  └── cartId.ts

app/
  └── index.tsx
  └── test/
```

---

## 🔁 React Query Reference

| Hook                | Use case                           |
| ------------------- | ---------------------------------- |
| `useQuery`          | Read: product, cart, menu          |
| `useInfiniteQuery`  | Pagination: PLP, search            |
| `useMutation`       | Write: add/update/remove from cart |
| `invalidateQueries` | Refetch specific data on change    |

Example:

```ts
const { data } = useQuery({
  queryKey: ["product", handle],
  queryFn: () => getProductByHandle(handle),
})
```

---

## 🛠 Services Layer

Service functions isolate logic like this:

```ts
export async function getProductByHandle(handle, locale) {
  return callShopify(() =>
    shopifyClient.request(ProductByHandleDocument, {
      handle,
      country: locale?.country,
      language: locale?.language,
    }),
  )
}
```

Use in hook:

```ts
export function useProduct(handle) {
  const locale = currentLocale()
  return useQuery({ queryKey: ["product", handle], queryFn: () => getProductByHandle(handle, locale) })
}
```

---

## 🌎 Localization via Preferences

Zustand store: `store/prefs.ts`

```ts
export const usePrefs = create<PrefsState>((set) => ({
  country: "US",
  language: "EN",
  currency: "USD",
  setPrefs: (prefs) => set((prev) => ({ ...prev, ...prefs })),
}))

export function currentLocale() {
  const { country, language } = usePrefs.getState()
  return { country, language }
}
```

All GraphQL queries use `@inContext` and accept `country` and `language`.

---

## 🛒 Cart Flow

Zustand + MMKV + GraphQL mutations

```ts
const { cartId, setCartId } = useCartId() // store
const { mutate: addToCart } = useAddToCart()

await ensureCart() // creates if not exists
addToCart({ merchandiseId: variantId, quantity: 1 })
```

Hooks:

- `useEnsureCart()`
- `useCartQuery()`
- `useAddToCart()` / `useUpdateLine()` / `useRemoveLine()`

Cart ID is persisted via MMKV or fallback.

---

## 🧭 Menus from Shopify Admin

Query menus like this:

```ts
const { data: menu } = useMenu("main-menu")
```

Get `AppMenuItem[]` with nested children and routes.

Use helper:

```ts
const path = routeToPath(item.route)
router.push(path)
```

---

## 💡 Adding a New Feature (Playbook)

### Example: Recommended Products carousel

1. Create query:

```graphql
query RecommendedProducts($productId: ID!, $country: CountryCode, $language: LanguageCode) @inContext(...) {
  productRecommendations(productId: $productId) { ...ProductCard }
}
```

2. Run codegen

3. Add service:

```ts
export async function getRecommendedProducts(productId, locale) {
  return callShopify(() =>
    shopifyClient.request(RecommendedProductsDocument, {
      productId,
      country: locale?.country,
      language: locale?.language,
    }),
  )
}
```

4. Add hook:

```ts
export function useRecommendedProducts(productId: string) {
  const locale = currentLocale()
  return useQuery({
    queryKey: ["recommended", productId, locale],
    queryFn: async () => (await getRecommendedProducts(productId, locale)).productRecommendations ?? [],
  })
}
```

5. Use in PDP:

```tsx
const { data: recommended } = useRecommendedProducts(product.id)
```

---

## 🔐 MMKV & Expo Go Notes

- In **Expo Go**, MMKV v3 is unavailable → fallback is used (in-memory or AsyncStorage).
- When building with **Dev Client** or **EAS**, MMKV v3 works by default.
- You can safely leave the fallback in place.

---

## 📱 Mobile – Customer Account Auth (PKCE)

### Required environment variables

- `EXPO_PUBLIC_SHOPIFY_DOMAIN`
- `EXPO_PUBLIC_SHOPIFY_SHOP_ID`
- `EXPO_PUBLIC_SHOPIFY_CLIENT_ID`

### How to test the login flow

1. Ensure the variables above are set and rebuild the development client if they change.
2. Open the account tab (avatar icon) and tap **Log in with Shopify**.
3. Complete the Shopify Customer Account login and wait for the redirect back to the app.
4. Verify profile, orders, and address data load; pull-to-refresh to confirm silent token refresh.

### Resetting the session

- Use the **Log out** button on the account home screen, or run `pnpm reset-project` during development to clear MMKV
  storage.

### Shopify customer-account checklist

- Store setting: Admin -> Settings -> Customer accounts -> enable Customer accounts (new).
- Partner Dashboard: API access -> Protected customer data Level 1; add Level 2 fields (name/email/phone/address) if you
  use them. On dev stores, selecting fields enables testing without formal review.
- Env: `EXPO_PUBLIC_SHOPIFY_SHOP_DOMAIN`, `EXPO_PUBLIC_SHOPIFY_CLIENT_ID`, optional overrides for
  `EXPO_PUBLIC_SHOPIFY_AUTH_SCHEME`, discovery endpoints, or GraphQL endpoint.
- Sanity check: curl the discovered `/.well-known/customer-account-api`, then POST `{ customer { id } }` to
  `graphql_api` with the bearer token. A quick probe:
  - `curl https://{shop-domain}/.well-known/customer-account-api`
  - `curl -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"query":"{ customer { id } }"}' https://{graphql-url}`
- Interpret the result: HTTP 200 with `errors[]` means data is redacted until permissions are approved; 404 means the
  endpoint or store setup needs attention.

---

## ✅ Final Summary

You’ve built:

- A typed Shopify API integration
- A scalable service + query architecture
- Fully cached cart, products, search, and menus
- Dynamic navigation powered by Shopify Admin
- Clean state handling and local persistence

Use this doc to repeat your success. One feature at a time.

---
