# OptionQaaf Mobile Home — Shopify Metaobjects Guide

This guide shows how to configure Shopify Metaobjects to fully control the OptionQaaf mobile home page. It includes the data model, definitions to create in Shopify, all supported section kinds, and tips for targeting and scheduling.

---

## Overview

- The app reads a single Metaobject of type `mobile_home` (by handle, default: `app-home`).
- That object contains a `sections` list. Each entry references a Metaobject describing one section of the home page.
- Each section has a `kind` (what to render) and fields specific to that kind (images, links, collections, etc.).
- Sections can be targeted by `country` and `language` and scheduled via `startAt`/`endAt`.

---

## Data Model

Top-level metaobject (type `mobile_home`):
- `handle` (e.g., `app-home`)
- `sections`: List of references to section metaobjects

Section metaobject (flexible; single definition or one per kind):
- Common fields: `kind`, `title`, `url` (or `link`), `theme`, `country`, `language`, `startAt`, `endAt`
- Kind-specific fields: images (`image`, `image2`, `image3`), `align`, `speed`, `collection`, etc.

The app ignores references that are not Metaobjects and skips unknown `kind` values gracefully.

---

## Step‑By‑Step Setup

1) Create the Home metaobject definition
- Shopify Admin → Settings → Custom data → Metaobjects → Add definition
- Name: Mobile Home
- Type (API ID): `mobile_home`
- Fields:
  - `sections` — Type: List of “Metaobject reference” (allows many). This holds your section entries in the order you want them rendered.
- Save the definition.

2) Create a Home entry (the content item)
- Add entry for `mobile_home`
- Handle: `app-home` (default used by the app) or your preferred handle.
- Populate the `sections` list by referencing your section metaobjects (created in the next step) in the desired order.

3) Create the Section metaobject definition
- Name: Mobile Home Section
- Type (API ID): `mobile_home_section` (you may choose any, the app reads by field keys)
- Create the following fields exactly as keys below:
  - `kind` — Single line text (Required)
  - `title` — Single line text
  - `subtitle` — Single line text (used in marquee as fallback)
  - `url` — URL (you may also add `link` — URL; the app checks both)
  - `theme` — Single line text (e.g., `light` or `dark`)
  - `country` — Single line text (ISO alpha-2: `SA`, `AE`, etc.)
  - `language` — Single line text (`EN` or `AR`)
  - `startAt` — Date and time (ISO)
  - `endAt` — Date and time (ISO)
  - `image` — File (Reference → Media image)
  - `image2` — File (Media image)
  - `image3` — File (Media image)
  - `url2` (or `link2`) — URL
  - `url3` (or `link3`) — URL
  - `align` — Single line text (`left` | `center` | `right`)
  - `speed` — Number (for marquee speed; default 30)
  - `collection` — Reference → Collection
- Save the definition.

4) Create Section entries
- For each section you want on the home page, add a new `mobile_home_section` entry and fill the fields as listed below per kind.
- Add those entries to the `sections` list of your Home entry.

---

## Supported Section Kinds and Definition Plans

Below are all supported `kind` values with required/optional fields and recommended field types.

### 1) `hero_poster`
- Purpose: Large hero image with optional title and link.
- Required:
  - `image` — File (Media image)
- Optional:
  - `title` — Single line text
  - `url` — URL (link target)
  - `theme` — Single line text (`light`/`dark`)
  - `country`, `language` — Single line text
  - `startAt`, `endAt` — Date and time

### 2) `headline_promo`
- Purpose: Text headline/promo row with optional link.
- Required:
  - `title` — Single line text
- Optional:
  - `url` — URL
  - `theme`, `country`, `language`, `startAt`, `endAt`

### 3) `ribbon_marquee`
- Purpose: Scrolling marquee/ribbon text.
- Required:
  - `title` — Single line text (or use `subtitle` if you prefer)
- Optional:
  - `subtitle` — Single line text (used if `title` empty)
  - `speed` — Number (default: 30)
  - `theme`, `url`, `country`, `language`, `startAt`, `endAt`

### 4) `split_banner`
- Purpose: Banner with one image, text, and alignment.
- Required:
  - `image` — File (Media image)
- Optional:
  - `title` — Single line text
  - `url` — URL
  - `align` — Single line text (`left` | `center` | `right`)
  - `theme`, `country`, `language`, `startAt`, `endAt`

### 5) `duo_poster`
- Purpose: Two side-by-side posters, each with its own link.
- Required:
  - `image` — File (Left poster)
  - `image2` — File (Right poster)
- Optional:
  - `url` — URL (for left)
  - `url2` — URL (for right)
  - `country`, `language`, `startAt`, `endAt`

### 6) `trio_grid`
- Purpose: Three-tile grid, each tile optionally linked.
- Required:
  - `image`, `image2`, `image3` — Files (Media images)
- Optional:
  - `url`, `url2`, `url3` — URL per tile
  - `country`, `language`, `startAt`, `endAt`

### 7) `product_rail`
- Purpose: Horizontal product carousel from a collection.
- Required:
  - `collection` — Reference → Collection (the app uses the handle)
- Optional:
  - `title` — Single line text
  - `theme`, `country`, `language`, `startAt`, `endAt`

### 8) `editorial_quote`
- Purpose: Editorial/quote block.
- Required:
  - `title` — Single line text (the quote text)
- Optional:
  - `theme`, `url`, `country`, `language`, `startAt`, `endAt`

---

## Targeting and Scheduling

The app filters sections before rendering:
- Country filter: If `country` is set and doesn’t match the current user country, the section is hidden.
- Language filter: If `language` is set and doesn’t match (`EN`/`AR`), the section is hidden.
- Scheduling: If `startAt` is set and current time is before it, hidden. If `endAt` is set and current time is after it, hidden.

Current locale information is taken from the app store: `currentLocale()` in `@/store/prefs`.

---

## Naming, Order, and Variations

- Use a single `mobile_home` entry with handle `app-home` for the main home.
- You can create alternative homes (e.g., `ramadan-home`) and load by handle.
- The order of items in the `sections` list is the render order.
- Unknown `kind` values or non-metaobject references in `sections` are ignored.

---

## Images & Accessibility

- Use Media images (MediaImage) for `image`, `image2`, `image3` fields.
- Keep aspect ratios consistent by section type (hero wide; trio squares, etc.).
- Add alt text in Shopify’s media library; the app surfaces alt text where appropriate.

---

## Quick Example (Minimal)

1) Create `mobile_home` entry with handle `app-home`.
2) Create 3 `mobile_home_section` entries:
- A hero poster:
  - `kind`: `hero_poster`
  - `title`: New Arrivals
  - `image`: [media image]
  - `url`: https://yourstore.com/collections/new
- A product rail:
  - `kind`: `product_rail`
  - `title`: Trending Now
  - `collection`: [choose a collection]
- A trio grid:
  - `kind`: `trio_grid`
  - `image`/`image2`/`image3`: [media images]
  - `url`/`url2`/`url3`: [links]
3) Attach these 3 entries to the `sections` list (in order) on `app-home`.

---

## Troubleshooting

- Nothing renders:
  - Ensure the `mobile_home` entry exists and its handle matches what the app requests (default `app-home`).
  - Ensure the `sections` field contains Metaobject references (not directly products/collections).
  - Ensure each section has a valid `kind` listed above.
- Product rail empty:
  - Check that the `collection` field references a published collection with products available to the Storefront.
- Missing images:
  - Verify the fields are named exactly `image`/`image2`/`image3` and are “File (Media image)” types.
- Section not visible:
  - Check `country`, `language`, `startAt`, `endAt`—it may be filtered out by targeting or scheduling.

---

## Appendix — Field Keys Summary

Common keys (used by multiple kinds):
- `kind`, `title`, `subtitle`, `url` (or `link`), `theme`, `country`, `language`, `startAt`, `endAt`
- `image`, `image2`, `image3` (Media images)
- `url2`/`link2`, `url3`/`link3`
- `align`, `speed`, `collection`

Root metaobject (`mobile_home`):
- `sections` (List of Metaobject references)

This guide is derived from the app’s source of truth (see references above) and lists the exact keys the app reads at runtime.
