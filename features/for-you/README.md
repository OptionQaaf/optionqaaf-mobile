# For You Phase 1 (Logic Only)

## Repo scan findings
- Customer identity/auth: Shopify Customer Account API via OAuth PKCE (`features/auth/useShopifyAuth.tsx`, `lib/shopify/customer/auth.ts`). Auth state is token-based and guest mode is supported.
- Persistence currently used:
  - Async API: `lib/storage/storage.ts` (MMKV with AsyncStorage fallback)
  - Sync API: `lib/storage/mmkv.ts` (MMKV with in-memory fallback)
  - Secure tokens: `lib/storage/secureStore.ts`
- Existing state ownership:
  - Locale/currency prefs: `store/prefs.ts`
  - Cart id: `store/cartId.ts`
  - Wishlist: `store/wishlist.ts`
  - Onboarding completion flag: `lib/storage/flags.ts`
- Product opens/taps currently flow through `ProductTile` callbacks and route pushes to `/products/[handle]`. The canonical open destination is PDP (`app/products/[handle].tsx`).
- Shopify customer metafields are not currently used in the repo.

## Storage strategy
- Resolved strategy:
  - Guest users: local profile storage only.
  - Authenticated users: primary storage in Shopify customer metafield (`namespace: optionqaaf`, `key: for_you_profile_v1`) with local cache fallback.
- Implemented as a storage abstraction:
  - `ForYouProfileStorage` interface
  - `LocalForYouProfileStorage`
  - `ShopifyMetafieldForYouProfileStorage`
  - resolver in `storage/index.ts`

## Profile schema
- Versioned schema: `schemaVersion`, `updatedAt`, `gender`, signal buckets, recent handles, cooldowns.
- Signals are aggregated counters only (no raw event log):
  - by product handle/vendor/product type/tag
  - recency timestamps for decay
- Reset entrypoint: `resetForYouProfile()`.

## Decay and ranking
- Deterministic exponential decay with half-life over days.
- Ranking combines:
  - handle/vendor/productType/tag affinity
  - recency boost
  - diversity penalties (vendor repetition and recently served handles)
  - deterministic tie-break jitter from profile/date seed
- Output shape supports future UI pagination: ranked `items` + `nextCursor`.
- Cold start path:
  - `isColdStart(profile)` enables availability-first and newest-first ordering with deterministic day shuffle.
- Profile pruning:
  - `pruneForYouProfile(profile)` caps bucket sizes, caps recents, and removes stale entries (>120 days).

## Tracking API
- Single entrypoint: `trackForYouEvent(event)`.
- Tracked in this phase:
  - `product_open` (on PDP open)
  - `add_to_cart` (cart mutation path)
  - `add_to_wishlist` (PDP wishlist action)
  - `pdp_scroll_75_percent`
  - `pdp_scroll_100_percent`
  - `time_on_product_>8s`
- Writes are batched/debounced into aggregated profile updates.

## Limitations
- Shopify customer metafield GraphQL operations are best-effort against Customer Account API shape and gracefully fall back to local cache when unavailable.
- Candidate pool quality depends on available collection handles and product metadata (vendor/productType/tags) in Shopify.
- No UI gating/modal is implemented in this phase; only logic helpers (`needsGenderPrompt`, `getGender`, `setGender`).
