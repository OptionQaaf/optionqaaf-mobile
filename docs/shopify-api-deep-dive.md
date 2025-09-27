# OptionQaaf Mobile – Shopify API Deep Dive

This document exhaustively documents how the OptionQaaf mobile app talks to the Shopify Storefront API. It covers the
configuration we need, how GraphQL operations are organised, the service layer conventions, React Query integration,
error handling, and the playbook for shipping new features safely.

---

## 1. Environment & Credentials

- **Required env vars** (see `lib/shopify/env.ts`):
  - `EXPO_PUBLIC_SHOPIFY_DOMAIN`: shop domain, e.g. `optionqaaf.myshopify.com`.
  - `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`: Storefront API access token created in Shopify Admin.
  - `EXPO_PUBLIC_SHOPIFY_API_VERSION`: optional, defaults to `2025-07` in the app and `2024-10` in codegen.
- **Runtime guard**: the app throws at boot if `EXPO_PUBLIC_SHOPIFY_DOMAIN` is missing to avoid silent failures.
- **How requests are authenticated**: each call sets the `X-Shopify-Storefront-Access-Token` header (see `lib/shopify/client.ts`).
- **Locale awareness**: we always thread `CountryCode` and `LanguageCode` into queries using `@inContext` so pricing,
  inventory, and content match the current locale (pulled from `store/prefs.ts`).

---

## 2. GraphQL Schema & Code Generation

- **Schema source**: `codegen.ts` points at `https://${SHOPIFY_DOMAIN}/api/${API_VERSION}/graphql.json` and injects the
  storefront token header so codegen can introspect.
- **Documents**: we maintain hand-written operations in `lib/shopify/queries/**/*.graphql` and shared fragments in
  `lib/shopify/fragments.graphql`.
- **Generator config**:
  - Plugins: `typescript`, `typescript-operations`, `typed-document-node`.
  - Options: `enumsAsTypes` keeps Shopify enums as string literal types, `nonOptionalTypename` gives us reliable
    `__typename` narrowing.
  - Output: `lib/shopify/gql/graphql.ts` – a fully typed SDK containing TypeScript types and `DocumentNode` objects.
- **Workflow**:
  1. Add/modify `.graphql` files.
  2. Run `pnpm gql:gen` (or `pnpm gql:watch` for hot reload) so the generated file stays in sync.
  3. Import the generated `*Document` and `*Query`/`*Mutation` types inside services.
- **Why generated**: the typed documents integrate with `graphql-request` to enforce variable types and result shapes,
  giving React Query strongly typed data downstream.

---

## 3. Shopify Client Wrapper

- **GraphQL client** (`lib/shopify/client.ts`): wraps `graphql-request` so every call goes through the same endpoint.
- **`callShopify` helper**:
  - Measures latency and logs duration in dev builds (`[Shopify] 123ms`).
  - Normalises errors into a `ShopifyError` so UI layers can show friendly messages.
  - Surfaces Storefront user errors by concatenating `userErrors[].message` (see `services/cart.ts`).
- **Usage pattern**: every service calls `callShopify(() => shopifyClient.request(Document, variables))` ensuring
  consistent logging and error transformation.

---

## 4. Folder Structure & Responsibility

```
lib/shopify/
  client.ts               ← GraphQL client + error wrapper
  env.ts                  ← Runtime config + locale type
  fragments.graphql       ← Shared fragments for product/cart shapes
  gql/graphql.ts          ← Auto-generated types & documents
  queries/                ← Domain-specific GraphQL operations
  services/               ← Type-safe request functions + normalisers
  queryKeys.ts            ← Canonical React Query keys
features/
  */api.ts                ← Hooks that bind services to React Query
store/
  prefs.ts, cartId.ts     ← Locale + persisted cart identity
```

- Keep raw GraphQL definitions under `lib/shopify/queries` and transformations in `services`.
- `features/**/api.ts` is the only place UI code touches the network – UI components import hooks, not services.

---

## 5. Core Services (lib/shopify/services)

### 5.1 Products (`products.ts`)

- `getProductByHandle`: fetches PDP data, passes locale to `ProductByHandleDocument`.
- `getCollectionProducts`: paginated collection view, `pageSize`/`after` for infinite scrolling.
- `searchProducts`: text search with identical pagination signature.
- All return raw GraphQL results; UI layers derive nodes from `collection.products` or `products`.

### 5.2 Cart (`cart.ts`)

- Implements Storefront cart mutations and queries with strong typing (`CartCreateMutation`, etc.).
- `assertNoUserErrors` throws on Shopify `userErrors` to avoid inconsistent optimistic states.
- `updateLines`, `removeLines`, and `updateDiscountCodes` stream locale + mutation payloads.
- `ShopifyError` ensures UI receives concatenated messages such as "Variant is sold out".

### 5.3 Menus (`menus.ts`)

- `getMenuByHandle`: reads navigation menus configured in Shopify Admin.
- `normalizeMenu`: maps each menu item to an `AppRoute` union (collection/product/page/blog/article/url) and filters
  empty URLs so UI never renders dead links.

### 5.4 Brands (`brands.ts`)

- Paginates through `shop.productVendors` with 250-per-page, max 40 pages.
- Deduplicates vendor names and formats into `{ name, url }` structures for the Brands screen.

### 5.5 Home (`home.ts`)

- `getMobileHome`: fetches a `metaobject` of type `mobile_home` for dynamic landing pages.
- `normalizeHome`: converts `metaobject` references into strongly typed section descriptors (`hero_poster`,
  `poster_triptych`, `product_rail`, etc.), applies locale & schedule gating, and strips unsupported nodes.
- Helper utilities (`val`, `ref`, `imgFrom`) gracefully handle optional Shopify data.

### 5.6 Recommendations (`recommendations.ts`)

- Thin wrapper around Shopify product recommendation API; returns typed `productRecommendations` arrays.

---

## 6. React Query Integration (features/**/api.ts)

- **Query keys**: centralised in `lib/shopify/queryKeys.ts` to guarantee cache identity across the app.
- **Read hooks** (`useProduct`, `useCollectionProducts`, `useSearch`, `useMenu`, `useMobileHome`, `useBrandIndex`):
  - Call `currentLocale()` once per hook so queries re-run when locale changes.
  - Return typed data from underlying services (`.product`, `.collection`, `.nodes`).
  - Configure pagination via `useInfiniteQuery` where needed and reuse `pageInfo` from Shopify responses.
- **Cart hooks** (`features/cart/api.ts`):
  - Use `useMutation` for writes with optimistic updates (`onMutate`) to keep the UI snappy.
  - `useEnsureCart` lazily creates carts and persists IDs (`store/cartId.ts`).
  - `useSyncCartChanges` batches updates/removals to respect Shopify’s 10-line mutation limit.
  - Every successful mutation invalidates the cached cart query to resync with Shopify.
- **Menu hook** keeps previous data between refetches and has tuned `staleTime`/`gcTime` so navigation remains cached.

---

## 7. Locale & Persistence

- `store/prefs.ts` hydrates locale/currency from MMKV storage and exposes `currentLocale()` for synchronous reads.
- Every service accepts an optional `{ country, language }` payload; hooks pass `currentLocale()` implicitly.
- Cart identity lives in `store/cartId.ts`, persisted via `lib/storage/storage.ts`. Hydration occurs at boot using
  `hydrateCartId()` before cart hooks run.

---

## 8. Error Handling & Logging

- All network errors resolve to `ShopifyError`, retaining the original cause for debugging.
- Cart mutations call `assertNoUserErrors` so Shopify validation issues surface immediately as exceptions.
- In dev builds (`__DEV__` flag) every request prints duration or warning to the console to spot slow queries early.
- React Query hooks use `onError` to roll back optimistic cart changes when mutations fail.

---

## 9. Adding a New API Capability (Playbook)

1. **Design the data**: sketch the component needs and decide whether it fits an existing service or a new one.
2. **Author the GraphQL query/mutation**:
   - Add a `.graphql` file to `lib/shopify/queries/` (and reuse fragments from `fragments.graphql`).
   - Remember to include locale arguments and `@inContext` blocks when data should be localised.
3. **Regenerate types**: run `pnpm gql:gen` to refresh `lib/shopify/gql/graphql.ts`.
4. **Create/extend a service**:
   - Import the generated `*Document` and `*Query`/`*Mutation` types.
   - Wrap the `shopifyClient.request` call in `callShopify`.
   - Normalise the response if the UI expects a simplified shape.
5. **Expose a React Query hook**:
   - Place it under `features/<domain>/api.ts`.
   - Compose `queryKey` via helpers from `lib/shopify/queryKeys.ts`.
   - Pass locale from `currentLocale()` so cache keys stay stable.
   - For mutations, implement `onMutate`/`onError` to keep the cart/product state consistent.
6. **Update the UI**: import the hook into screens/components and handle loading/error states.
7. **QA**:
   - Test with different locales (English/Arabic) to verify `@inContext` behaviour.
   - Validate edge cases like empty results, sold-out variants, or Shopify throttling.
   - Monitor dev console for `[Shopify] failed…` warnings.

---

## 10. Operational Notes

- **Pagination**: Shopify pagination uses cursors; we mirror that contract to `useInfiniteQuery`.
- **Mutation limits**: Cart operations batch payloads into groups of 10 (`SHOPIFY_CART_MUTATION_LIMIT`). If you add bulk
  actions, reuse the `chunk` helper or respect the limit manually.
- **Images & media**: fragments request transformed WebP URLs (`url(transform: { preferredContentType: WEBP })`) to
  reduce payload size on mobile.
- **Currency formatting**: UI code calls `lib/shopify/money.ts` `formatMoney()` to turn `MoneyV2` into locale-aware strings.
- **Debugging**: you can temporarily enable verbose GraphQL logging by checking `__DEV__` logs or wrapping services with
  additional `try/catch` if needed.

---

## 11. Reference Commands

```bash
pnpm gql:gen      # regenerate TypeScript types after editing .graphql files
pnpm start        # launch Expo bundler
pnpm lint         # sanity-check code style before committing
```

Everything above is the contract that keeps our Shopify integration reliable, typed, and maintainable. Treat services
as the source of truth for backend access, and use the playbook when you extend the API surface.
