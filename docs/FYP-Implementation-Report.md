# For You Page (FYP) Implementation Report

## 1. Scope

This report documents the current implementation of:

- Personalized **For You** retrieval and ranking.
- Product signal collection, profile updates, and persistence.
- Feed-to-reel navigation and reel-like product scrolling behavior.
- Shopify recommendation integration.
- Performance and UX guardrails currently in code.

The report reflects the current code state in this repository as of **February 15, 2026**.

---

## 2. High-Level Architecture

### 2.1 Main Layers

- UI and navigation
  - `app/(tabs)/home/for-you.tsx`
  - `app/(tabs)/home/_layout.tsx`
  - `app/products/for-you-feed.tsx`
  - `ui/nav/MenuBar.tsx`
- Personalization feature layer
  - `features/for-you/api.ts`
  - `features/for-you/service.ts`
  - `features/for-you/profile.ts`
  - `features/for-you/tracking.ts`
  - `features/for-you/contentSignals.ts`
  - `features/for-you/storage/*`
- Shopify retrieval layer
  - `lib/shopify/services/forYou.ts`
  - `lib/shopify/services/recommendations.ts`
  - `lib/shopify/services/products.ts` (used by handle-based seed expansion)
- Local feed transfer state
  - `store/forYouFeed.ts`

### 2.2 Data Flow Overview

1. FYP screen requests ranked products via `useForYouProducts`.
2. `getForYouProducts` fetches candidate products from collections (+ profile handle seed candidates).
3. Candidates are filtered by gender rules, ranked by profile and exploration logic, then returned.
4. Top results are shown in masonry on FYP screen.
5. Clicking a tile opens the reel screen with:
   - Selected product as seed.
   - Shopify `productRecommendations` results.
   - Personalized tail from current FYP list sorted by seed similarity.
6. User actions (`product_open`, `variant_select`, `add_to_cart`, etc.) are tracked and batched into the profile.
7. Profile persists locally and (if authenticated and permitted) to Shopify customer metafield.

---

## 3. FYP Profile Model and Signals

Source: `features/for-you/profile.ts`

### 3.1 Profile Shape

`ForYouProfile` stores:

- `schemaVersion`, `updatedAt`, `gender`.
- `signals` buckets:
  - `byProductHandle`
  - `byVendor`
  - `byProductType`
  - `byTag`
  - `recentHandles`
- `cooldowns.recentlyServedHandles`

### 3.2 Supported Event Types

- `product_open`
- `add_to_cart`
- `add_to_wishlist`
- `search_click`
- `variant_select`
- `pdp_scroll_75_percent`
- `pdp_scroll_100_percent`
- `time_on_product_>8s`

### 3.3 Event Weighting (Current Constants)

Per-event delta by signal type:

- Handle weights: `2.5`, `4.5`, `4`, `2`, `1`, `3.1`, `3.7`, `3.3`
- Vendor weights: `1.4`, `2.4`, `2.2`, `1`, `0.6`, `0.9`, `1.1`, `1`
- Product type weights: `0.9`, `1.8`, `1.5`, `0.8`, `0.5`, `0.6`, `0.8`, `0.75`
- Tag weights: `0.5`, `1.1`, `0.9`, `0.5`, `0.3`, `0.35`, `0.45`, `0.4`

(Ordered by event list above.)

### 3.4 Decay and Pruning

- Half-life decay for scoring: `21 days`.
- Profile pruning window: `120 days` max age.
- Max retained entries per bucket before compaction: top `100` by effective score.
- Profile JSON hard cap: `48 KB` (`FOR_YOU_PROFILE_MAX_JSON_BYTES`).
- Progressive compaction caps down to minimal profile if needed.

### 3.5 Signal Enrichment for Sparse Catalog Data

Because many products have empty `productType` and sparse tags, the profile logic derives extra tags from tokenized text:

- Base tags
- Vendor
- Product type
- Title
- Handle
- Token bigrams

This is handled by `deriveSignalTags(...)` and helps with similarity even when core fields are incomplete.

---

## 4. Retrieval Pipeline (For You Screen)

Primary source: `features/for-you/service.ts`.

### 4.1 Candidate Sources

1. **Collection pool candidates** from `lib/shopify/services/forYou.ts`:
   - Round-robin across collection handles.
   - Cursor state stores per-handle cursor and exhaustion.
2. **Profile handle candidates**:
   - Top scored and recent handles are expanded via `getProductByHandle`.

Both are merged and deduplicated by product id.

### 4.2 Collection Handle Resolution

- Starts with gender-based defaults:
  - Male: `men-1`, `men`
  - Female: `women-1`, `women`
  - Unknown: both sets
- Adds product rails discovered from mobile home metaobject sections.
- Adds fallback handles: `new-arrivals`, `new-in`, `all`, `all-products`.

### 4.3 Gender Filtering

Two-stage logic:

- Strict filter:
  - Male => has `men` tag and not `women`
  - Female => has `women` tag and not `men`
- Loose fallback if strict returns none:
  - Male => not tagged `women`
  - Female => not tagged `men`

Unknown gender skips filtering.

### 4.4 Exploration vs Personalization Mix

- `explorationRatio` increases with page depth:
  - Page 0: `0.08`
  - 1: `0.14`
  - 2: `0.20`
  - 3: `0.27`
  - 4: `0.34`
  - 5+: `0.42`

### 4.5 Refresh Novelty Window

On refresh round (`refreshKey > 0`) for first page only:

- Blocks recently served handles using dynamic block count.
- Returns fresh candidates if enough fresh items exist.
- Falls back to full candidate set if freshness floor is not met.

### 4.6 Cold Start vs Warm Start

- Cold start when effective handle/vendor/productType signals are all low.
- Cold start ranking favors:
  - Available products
  - Newer products (`createdAt`)
  - Small deterministic jitter
- Warm ranking uses `rankForYouCandidates(...)` scoring.

---

## 5. Ranking Logic (Warm Profile)

Source: `features/for-you/profile.ts` (`rankForYouCandidates`).

For each candidate:

1. Resolve normalized fields and derived tags.
2. Compute decayed effective scores for handle/vendor/type/tags.
3. Compute personalized score:

```text
personalized =
  handleScore * 2.8 +
  vendorScore * 1.7 +
  productTypeScore * 1.3 +
  tagScore * 0.9 +
  recentHandleBoost(1.25 if in recentHandles)
```

4. Compute exploration score:

```text
familiarity = handle*2.2 + vendor*1.4 + productType + tag*0.7
noveltyBoost = 1 / (1 + familiarity)
freshnessBoost = 1 / (1 + ageDays/20)
exploration = noveltyBoost*3 + freshnessBoost*1.6
```

5. Blend:

```text
blended = personalized*(1 - explorationRatio)
        + exploration*explorationRatio*depthAmplifier
```

6. Penalize recently served handles (`-3`) and add deterministic jitter.
7. Sort descending by score.
8. Diversity constraints during selection:
   - For top 12 selected items, max 3 per vendor key.
   - Additional dynamic vendor repetition penalty.

Finally, selected set is sorted by adjusted score and returned.

---

## 6. Tracking, Flush, and Query Timing

Sources:

- `features/for-you/tracking.ts`
- `features/for-you/api.ts`

### 6.1 Event Queue

- Events queued in memory.
- Debounced flush delay: `900ms`.
- Flush applies all events to profile then persists once.

### 6.2 Important Ordering

Before each FYP product query, `useForYouProducts` calls:

- `flushForYouTracking()`

This ensures very recent interactions affect the next retrieval/ranking request.

### 6.3 Query Identity and Invalidation Semantics

For FYP products query key includes:

- locale
- gender
- `profileHash` (top signals hash)
- page size
- refresh key

This gives cache segmentation per meaningful personalization state.

---

## 7. Storage and Identity Resolution

Sources:

- `features/for-you/storage/index.ts`
- `features/for-you/storage/localStorage.ts`
- `features/for-you/storage/shopifyMetafieldStorage.ts`

### 7.1 Identity

- Identity resolved from valid customer token + customer id fetch.
- Memoized for `60s` TTL.

### 7.2 Local Storage

Scoped key:

- Guest: `for_you.profile.v1.guest`
- Customer: `for_you.profile.v1.customer.<id>`

### 7.3 Remote Storage

Customer metafield:

- Namespace: `custom`
- Key: `for_you_profile`
- Type: `json`

### 7.4 Resolver Policy

- Read path:
  - Authenticated: try remote first, sync down to local if found.
  - Unauthenticated / failures: local fallback.
- Write path:
  - Always local.
  - Remote best-effort when authenticated.
  - If remote auth error includes `APP_NOT_AUTHORIZED`, remote writes are disabled for session.

This preserves personalization continuity even when remote writes fail.

---

## 8. Shopify Candidate Retrieval Details

Source: `lib/shopify/services/forYou.ts`.

### 8.1 Query Data Pulled Per Product

Includes:

- id, handle, title, vendor, productType, tags, createdAt, availability
- featured image + first 6 images
- priceRange + compareAtPriceRange

### 8.2 Collection Paging Strategy

- Round-robin collection traversal prevents over-concentration from a single collection.
- Cursor state tracks each collection independently.
- Continues until target pool reached or all handles exhausted.

### 8.3 Cursor Structure

`ForYouCursorState`:

- `handleIndex`
- `page`
- `byHandle: Record<handle, cursor|null>`
- `exhausted: string[]`

Serialized as JSON cursor.

---

## 9. HTML/Media Content Signal Extraction

Source: `features/for-you/contentSignals.ts`.

### 9.1 Why It Exists

Many catalog products are sparse in `productType` and clean tags, so extra semantic terms are extracted from descriptions and media metadata.

### 9.2 Inputs and Processing

From product details:

- `descriptionHtml`
- `description`
- image alt texts
- handle/title/vendor/productType

Extraction steps:

- Strip script/style blocks.
- Parse HTML text.
- Parse `<img alt>` terms.
- Parse `<img src>` filename terms.
- Tokenize and generate bigrams.
- Remove stopwords and short/number-only tokens.
- Deduplicate and cap.

### 9.3 Overhead Controls

Hard limits:

- HTML processed: max `12,000` chars
- Stripped text processed: max `6,000` chars
- Returned terms: max `28`

This keeps signal extraction bounded for mobile performance.

---

## 10. FYP Screen Implementation (Grid)

Source: `app/(tabs)/home/for-you.tsx`.

### 10.1 UX Behavior

- 2-column masonry-like product tiles.
- Pull-to-refresh increments `refreshKey`.
- Infinite pagination triggers near bottom (`+320px` threshold).
- On tab focus and tab press, refresh key increments for new mix.

### 10.2 Debug Instrumentation

In dev mode:

- Logs ranked top 20 sample.
- Logs pool debug stats (`candidateCount`, `handleCount`).

### 10.3 Navigation to Reel Screen

On tile press:

- Stores entire current item list in Zustand (`useForYouFeedStore`).
- Navigates to `/products/for-you-feed` with `initialIndex` and serialized handles.

---

## 11. Reel Screen Implementation (Product Scrolling)

Source: `app/products/for-you-feed.tsx`.

### 11.1 “Double Personalization” Design (Current)

Feed composition:

1. Seed item = clicked product.
2. Add Shopify recommendations for seed (`RELATED`, up to 18).
3. Add personalized tail from FYP list, sorted by similarity to seed.
4. Deduplicate by handle, preserving order.

This creates:

- Level 1 personalization: FYP list.
- Level 2 personalization: seed-centric reel sequence.

### 11.2 Recommendations API Integration

Hooks/service:

- `useRecommendedProducts(...)` in `features/recommendations/api.ts`
- `getRecommendedProducts(...)` in `lib/shopify/services/recommendations.ts`

Important fix applied in current codebase:

- Uses **two separate GraphQL documents** so only one of `productId` or `productHandle` is sent, avoiding Shopify validation error.

### 11.3 Similarity Scoring for Personalized Tail

`scoreSimilarity(seed, candidate, index)` adds:

- Vendor exact match: `+7`
- Product type exact match: `+4.5`
- Tag overlap: up to `+4`
- Token overlap (title/handle/vendor): up to `+5`
- Position prior: starts `+1.2`, decreases by index

### 11.4 Scroll Mechanics

- Vertical `FlatList` with `snapToInterval` (reel card height).
- Card height ratio target `0.79` of viewport with minimum bounds.
- Top padding accounts for floating menu bar and safe area.
- Bottom padding includes “peek” so next product is partially visible.

### 11.5 Product Detail Block per Reel Card

For each card:

- Fetches product details via `useProduct(handle)`.
- Auto-selects first available variant.
- Tracks `product_open` once per viewed handle.
- Prefetches next 2 product detail queries.
- Shows single `AddToCart` block at bottom of content area.

### 11.6 Variant Selector UX (Current State)

- Custom bottom-sheet style selector (`NativeVariantSelect`).
- Tap field opens modal anchored to bottom.
- Sheet slide-up/down animation.
- Backdrop handled with separate fade animation.
- Variant controls laid out in 2-column grid to reduce vertical space.
- Variant section is capped height and internally scrollable.

---

## 12. Navigation and Menu/Tab Layout

Sources:

- `app/(tabs)/home/_layout.tsx`
- `ui/nav/MenuBar.tsx`

### 12.1 Current Behavior

- Top tabs are custom-rendered and overlayed at top with absolute positioning.
- `MenuBar` remains white, centered logo, optional left back icon.
- Scene content is padded from top (`insets.top + MENU_BAR_HEIGHT`) so screens start below menubar zone.

### 12.2 Safe Area and Overflow Controls

- `MenuBar` floating mode uses `SafeAreaView` with top edge handling.
- Reel list `contentContainerStyle.paddingTop` includes safe-area + menu height to avoid image/header overlap.

---

## 13. Performance and UX Guardrails

### 13.1 Query/Network

- Candidate pool bounded (`20..400`, default 200).
- Per-collection page size bounded (`20..100`, default 40).
- Recommendation seed cap (`MAX_RECOMMENDED_SEEDS = 18`).

### 13.2 Rendering

- Reel FlatList uses:
  - `removeClippedSubviews`
  - bounded `windowSize`
  - low `initialNumToRender`
  - deterministic `getItemLayout`

### 13.3 Personalization Storage

- Profile pruning and compaction avoid oversized payloads.
- Batched event flush avoids write-per-interaction behavior.

### 13.4 Content Signals

- HTML parsing bounded by char limits and term limits.
- Avoids unbounded parsing cost from long descriptions.

---

## 14. Current Constraints and Observed Gaps

### 14.1 Catalog Metadata Quality

From debug sample, many products show:

- empty `productType`
- very generic tags (`women` only)

This reduces semantic precision of ranking and seed similarity unless augmented by extracted text/media signals.

### 14.2 Recommendations Dependence

If Shopify recommendations are sparse for a seed, reel tail relies more heavily on local similarity logic over current FYP pool.

### 14.3 Signal Coverage

Some high-value behaviors are defined in event types (scroll depth/time on product), but coverage depends on whether those events are emitted by the relevant screens.

### 14.4 UI Mixing of `style` and `className`

Some screens still use inline style objects where NativeWind classes are also used; behavior is functional but not fully class-only.

---

## 15. Practical Summary of “How FYP Works Right Now”

In direct terms:

1. We do not rely on only one field (like brand). We score across handle, vendor, type, tags, and derived tokens.
2. We blend personalization with exploration and freshness, stronger exploration on deeper pages.
3. We suppress immediate repeats via recently-served cooldown.
4. We use click/open/cart/variant interactions to continuously update profile weights.
5. Reel feed starts at tapped product and then uses both Shopify recommendations and user-personalized local sequence.
6. HTML/media-derived terms are already used to enrich weak catalog metadata with bounded overhead.

---

## 16. Suggested Next Iteration (Minimal-Risk, High Impact)

1. Emit and validate `pdp_scroll_75_percent`, `pdp_scroll_100_percent`, and `time_on_product_>8s` consistently in reel and PDP contexts.
2. Add optional debug scoring breakdown per candidate in dev mode (`handle/vendor/type/tag/exploration components`) to speed tuning.
3. Add lightweight telemetry counters for recommendation hit-rate and duplicate suppression rate.
4. Normalize/curate catalog `productType` upstream where possible to increase ranking precision.

---

## 17. Key Files Reference Map

- FYP query hooks: `features/for-you/api.ts`
- Ranking + profile model: `features/for-you/profile.ts`
- Retrieval orchestration: `features/for-you/service.ts`
- Event batching: `features/for-you/tracking.ts`
- Content extraction: `features/for-you/contentSignals.ts`
- Storage resolver: `features/for-you/storage/index.ts`
- Local profile storage: `features/for-you/storage/localStorage.ts`
- Shopify metafield storage: `features/for-you/storage/shopifyMetafieldStorage.ts`
- Collection candidate fetch: `lib/shopify/services/forYou.ts`
- Recommendations fetch: `lib/shopify/services/recommendations.ts`
- Recommendations hook: `features/recommendations/api.ts`
- FYP screen UI: `app/(tabs)/home/for-you.tsx`
- Home tabs/menu shell: `app/(tabs)/home/_layout.tsx`
- Reel feed screen: `app/products/for-you-feed.tsx`
- Menu bar component: `ui/nav/MenuBar.tsx`
- Feed transfer store: `store/forYouFeed.ts`

