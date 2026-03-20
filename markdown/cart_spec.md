# OptionQaaf — Production Cart Specification
> Shopify Storefront API · React Native / Expo · March 2026

---

## 1. Foundations

### Cart Model (Current — Post-April 2025)
- **No Checkout API.** `createCheckout()`, `checkoutId`, `client.checkout.create()` are dead.
- Flow: `cartCreate` → manage lines → hand user `cart.checkoutUrl` → Checkout Sheet Kit handles payment.
- Carts expire **30 days** after last mutation. Completed carts are deleted immediately by Shopify.

### Cart Object — Key Fields
```
cart
  id                          # gid://shopify/Cart/... — store in AsyncStorage
  checkoutUrl                 # pass to Checkout Sheet Kit
  note                        # order note
  attributes { key value }    # custom metadata (gift wrapping, etc.)
  discountCodes { code applicable }
  discountAllocations { ... } # CART-LEVEL discounts
  cost { ... }                # subtotal, total, taxes — ALL ESTIMATED
  lines(first: 50) {
    CartLine {
      id
      quantity
      instructions { removable quantityAvailable }
      attributes { key value }
      cost { amountPerQuantity compareAtAmountPerQuantity totalAmount subtotalAmount }
      discountAllocations { ... }   # LINE-LEVEL discounts — SEPARATE from cart-level
      merchandise {
        ... on ProductVariant {
          id title availableForSale quantityAvailable
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
          image { url altText }
          product { id title handle }
        }
      }
    }
  }
  deliveryGroups(first: 5 withCarrierRates: true) { ... }
```

### Discount Data — Two Levels (Critical)
| Level | Location | Covers |
|---|---|---|
| Cart-level | `cart.discountAllocations` | Order-% off, fixed off order, free shipping |
| Line-level | `line.discountAllocations` | Product discounts, BOGO free items |

Each allocation `__typename`: `CartAutomaticDiscountAllocation` (has `title`), `CartCodeDiscountAllocation` (has `code`), `CartCustomDiscountAllocation` (has `title`).

**Never** look only at `cart.discountAllocations`. Always query both levels. They are independent.

### CartCost Fields
- `subtotalAmount` — before taxes and cart-level discounts. Has `subtotalAmountEstimated` bool.
- `totalAmount` — after all discounts and taxes. Has `totalAmountEstimated` bool.
- `totalTaxAmount` — null if taxes included in prices.
- `checkoutChargeAmount` — excludes deferred subscription payments.
- When `isEstimated: true` → show asterisk + "Final amount may vary at checkout."

---

## 2. State Architecture

### Three Layers
| Layer | Contents |
|---|---|
| Shopify server | Cart ID, lines, pricing, allocations — authoritative truth |
| React Context | Hydrated cart object, per-op loading flags, error state |
| AsyncStorage/MMKV | Cart ID only — for reconnecting on app restart |

### Context Shape
```
cartContext {
  cart: CartObject | null
  isAddingLine: boolean       # per-operation flags, not one global flag
  isUpdatingLine: boolean
  isRemovingLine: boolean
  isApplyingDiscount: boolean
  error: string | null
  totalQuantity: number       # drives tab bar badge
  addLine(merchandiseId, qty)
  updateLine(lineId, qty)
  removeLine(lineId)
  applyDiscount(code)
  removeDiscount(code)
}
```

### Initialization Flow
1. Read cart ID from AsyncStorage.
2. If none → do nothing. Create lazily on first add-to-cart.
3. If exists → `cart(id: $id)` query.
4. If response is `null` or "cart not found" error → clear storage, set empty state (no error shown).
5. If success → hydrate context.
6. If user is logged in → run `cartBuyerIdentityUpdate` with their access token.

### Optimistic Updates (Mandatory)
1. User taps quantity button.
2. Immediately update in-memory state. Mark line `isOptimistic: true`.
3. Disable that line's controls while `isOptimistic`.
4. Fire mutation.
5. On success → replace state with server-returned cart.
6. On failure → roll back to pre-action state, show inline error.

---

## 3. Mutations Reference

| Mutation | Use Case |
|---|---|
| `cartCreate` | First add-to-cart (no cart exists). Creates cart + adds first line. |
| `cartLinesAdd` | Add product to existing cart. |
| `cartLinesUpdate` | Change quantity. Never use with qty=0 (use Remove). |
| `cartLinesRemove` | Delete lines. Use when qty would reach 0. |
| `cartDiscountCodesUpdate` | Apply/remove codes. Replaces entire array atomically. |
| `cartGiftCardCodesAdd` | Gift cards — separate from discount codes. |
| `cartBuyerIdentityUpdate` | Associate logged-in customer, country code. |
| `cartNoteUpdate` | Order note. |
| `cartAttributesUpdate` | Custom metadata. |
| `cartDeliveryAddressesAdd` | Add address to unlock shipping rates. |

**Every mutation** returns `{ cart { ...fullShape } userErrors { field message } }`. Always request the full cart shape and replace the entire context state with the returned cart.

### Key userErrors
| Message | Response |
|---|---|
| Cart not found | Clear ID, recreate cart, retry operation silently |
| Merchandise not available | Show unavailable badge on that line. Don't block rest of cart. |
| Quantity must be > 0 | Never send qty=0. Route through `cartLinesRemove`. |
| Discount code invalid/expired | Inline error under code input. Show `applicable: false` on the chip. |
| Discount code cannot be applied | "Code doesn't apply to items in your cart." |
| Too many discount codes | Prompt user to remove one first. |

### Retry Logic
- Network failure (5xx / no response) → exponential backoff, max 2 retries.
- Cart not found → recreate-and-retry (not time-based).
- userErrors → never auto-retry. Requires user action.

---

## 4. Discounts — All Types

### Type 1: Manual Code (% or fixed)
- Order-level → shows in `cart.discountAllocations` only. Lines have empty allocations.
- Product-level → shows in qualifying `line.discountAllocations`. Non-qualifying lines empty.
- `discountCodes[].applicable: false` → code entered but invalid. Show warning chip, not removal.

### Type 2: Automatic Discounts
- No code from user. Appear in `discountAllocations` with `__typename CartAutomaticDiscountAllocation`.
- `discountCodes` array will be empty even though a discount is active.
- **Must** display savings even when `discountCodes` is empty.

### Type 3: BOGO / Buy X Get Y Free
- Free item is a normal CartLine at regular price.
- Discount appears as `line.discountAllocations` reducing that line's cost to 0.
- UI: strike-through original price + "FREE" badge.
- **Bug:** Removing a BOGO code does NOT immediately clear `discountAllocations` from the line. Always re-fetch full cart from server after any `cartDiscountCodesUpdate`. Never trust local state after discount mutations.
- Removing the "qualifying" (buy) items should deactivate the free item's allocation → always re-fetch and re-render from server response.

### Type 4: Volume / Tiered
- Automatic discount activating at quantity thresholds.
- Shows as `CartAutomaticDiscountAllocation` on qualifying lines.
- "Spend X more to unlock next tier" banner → configure threshold yourself (metafield or hardcoded). Cart API only tells you what's active, not what's available.

### Type 5: Free Shipping
- Appears in `cart.discountAllocations`.
- Only visible when a delivery address is associated (otherwise `deliveryGroups` is empty).
- Show "Free shipping applied" message from allocation even before shipping rates load.

### Line Item Visual States
| Data | Display |
|---|---|
| No `discountAllocations` | Regular price × qty |
| `discountAllocations` present | Strike-through original, discounted price in green, badge with title |
| Allocation reduces to $0 | "FREE" badge, struck-through original price |
| `compareAtPrice` present | Strike-through compare-at price (sale item, separate from allocations) |
| `availableForSale: false` | Gray out, "Unavailable" badge, show Remove button |
| `instructions.removable: false` | Hide Remove button entirely |
| `instructions.quantityAvailable` | Cap stepper max, show "Only X left" |
| `isOptimistic: true` | Pulse shimmer, controls disabled |

### Order Summary Math
```
Subtotal (cart.cost.subtotalAmount)
- Cart-level discount allocations (cart.discountAllocations)
- Line-level discount allocations (sum of line.discountAllocations)
+ Shipping (selected delivery option cost)
+ Tax (cart.cost.totalTaxAmount)
= Total (cart.cost.totalAmount)
```
If `isEstimated` on any amount → show asterisk.

---

## 5. Shipping

- `deliveryGroups` is **empty** until buyer identity with country or a delivery address is set.
- No address → show "Shipping: Calculated at checkout." Never show a rate estimate.
- With address → show each `deliveryOption` (title, cost) as selectable rows. Reflect selected cost in total.
- Use `cartSelectedDeliveryOptionsUpdate` to change selection.
- Pass `withCarrierRates: true` to get carrier-calculated rates (slightly slower query).
- Free shipping threshold bar → configure threshold yourself, compare against `cart.cost.subtotalAmount`.

---

## 6. Edge Cases

| Scenario | Handling |
|---|---|
| Cart expired (30 days) | Fetch returns null → clear ID, show empty cart, no error |
| Checkout completed | Kit fires `completed` event → clear cart ID, reset context, navigate to success |
| Item goes out of stock mid-session | `availableForSale: false` on line → show warning, let user remove |
| Quantity exceeds stock | `cartLinesUpdate` returns userError → show "Only X available" inline |
| Multiple codes, one invalid | Apply valid ones, show inline error for the invalid one |
| Stale BOGO allocation after code removal | Re-fetch full cart from server. Render only from server state. |
| User taps qty − at 1 | Show trash icon. Call `cartLinesRemove`, not `cartLinesUpdate` with qty=0 |
| Empty cart | Show intentional empty state with CTA to browse. Not an error. |
| Price changes mid-session | Trust server price always. Never cache prices locally. |
| `instructions.removable: false` | Hide remove button. Don't attempt removal (will get userError). |
| Bundle (ComponentizableCartLine) | Handle separately via inline fragment. Has `components` sub-lines. Remove entire bundle atomically. |
| Network offline on open | Show last fetched state with "Cart may be out of date" banner. Re-fetch on reconnect. |
| Network failure during mutation | Roll back optimistic state. Show snackbar with "Try again" action. |
| Guest → logs in | Run `cartBuyerIdentityUpdate` immediately. Same cart ID, pricing may update. |
| `applicable: false` on discount code | Show warning tag on code chip. Don't silently remove it. |

---

## 7. Checkout Handoff

### Checkout Sheet Kit (`@shopify/checkout-sheet-kit`)
```
Install: @shopify/checkout-sheet-kit (official Shopify RN package)

Flow:
1. Cart screen mounts → preload(cart.checkoutUrl)
2. Any cart mutation → invalidate() → re-call preload(newCheckoutUrl)
3. User taps "Checkout" → present(cart.checkoutUrl)
4. Handle events:
   - completed → clear AsyncStorage cart ID, reset context, navigate to success
   - canceled  → do nothing, cart intact
   - error     → log, sheet shows its own error UI
   - pixelEvent → analytics
```
- Discount codes in `cart.discountCodes` carry over to checkout automatically via `checkoutUrl`.
- No need to pass codes separately to the Kit.

---

## 8. What to Always Request (Query Fields)

Always request these on every cart query and mutation response:

```graphql
cart {
  id checkoutUrl note
  attributes { key value }
  discountCodes { code applicable }
  discountAllocations {
    __typename
    discountedAmount { amount currencyCode }
    ... on CartAutomaticDiscountAllocation { title }
    ... on CartCodeDiscountAllocation { code }
    ... on CartCustomDiscountAllocation { title }
  }
  cost {
    subtotalAmount { amount currencyCode }
    subtotalAmountEstimated
    totalAmount { amount currencyCode }
    totalAmountEstimated
    totalTaxAmount { amount currencyCode }
    checkoutChargeAmount { amount currencyCode }
  }
  lines(first: 50) {
    edges { node {
      id quantity
      instructions { removable quantityAvailable }
      attributes { key value }
      cost {
        amountPerQuantity { amount currencyCode }
        compareAtAmountPerQuantity { amount currencyCode }
        totalAmount { amount currencyCode }
        subtotalAmount { amount currencyCode }
      }
      discountAllocations {
        __typename
        discountedAmount { amount currencyCode }
        ... on CartAutomaticDiscountAllocation { title }
        ... on CartCodeDiscountAllocation { code }
        ... on CartCustomDiscountAllocation { title }
      }
      merchandise {
        ... on ProductVariant {
          id title availableForSale quantityAvailable
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
          image { url altText width height }
          product { id title handle }
        }
      }
    }}
  }
}
```

**GraphQL depth limit is 17.** If you hit it, remove nesting from product fields.

---

## 9. Rules — Non-Negotiable

1. **Never calculate any price client-side.** All money values come from the server.
2. **Never send `cartLinesUpdate` with qty=0.** Use `cartLinesRemove`.
3. **Never render discount savings only when `discountCodes` is non-empty.** Automatic discounts exist without codes.
4. **Always re-fetch full cart after `cartDiscountCodesUpdate`.** Stale allocations bug.
5. **Always replace full context state from mutation response.** Never partial-merge.
6. **Persist only the cart ID.** Never persist items, prices, or the cart object.
7. **Pin the API version explicitly.** Never use `unstable` in production.
8. **Debounce quantity steppers** (300ms). Never fire a mutation per tap.
9. **Disable controls while `isOptimistic: true`** on a line.
10. **Handle `instructions.removable: false`** — hide remove button, never attempt removal.

---

## 10. Decision Summary

| Decision | Choice |
|---|---|
| Cart creation | Lazy — on first add-to-cart only |
| Cart ID storage | AsyncStorage (or MMKV) — ID only |
| Global state | React Context + useReducer |
| Optimistic updates | Mandatory, per-line with rollback |
| Checkout | `@shopify/checkout-sheet-kit` |
| Preloading | Yes — on cart screen mount, invalidate on every mutation |
| Expiry recovery | Silent recreate-and-retry |
| Price source | Server only, always |
| Shipping display | Only when address associated |
| API version | Pinned, explicit |
