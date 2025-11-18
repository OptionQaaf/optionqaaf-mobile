# OptionQaaf Mobile — Metaobject Sections Guide

This document explains how Shopify metaobjects drive the mobile Home, Men, and Women landing experiences. It covers the data model, required Shopify definitions, every supported `kind`, and the fields each section expects.

---

## Overview

- The app reads metaobjects of type `mobile_home`. Each entry corresponds to one composed landing (e.g. Home, Men, Women).
- A `mobile_home` entry exposes a `sections` list. Each list item references a `mobile_home_section` metaobject.
- Every section has a `kind` that maps to a React Native component plus a set of fields. Unknown kinds are ignored safely.
- Optional gating fields (`country`, `language`, `startAt`, `endAt`) let you target locales and schedule campaigns.
- The `kind` field is case insensitive—`Trio Grid`, `trio-grid`, or `TRIO_GRID` all resolve to `trio_grid`.
- Locale gates are also case-insensitive, so entering `sa` / `en` works the same as `SA` / `EN`.

---

## Data Model

Top-level metaobject (`mobile_home`):
- `handle` — Used by the app to select which landing to load (see handles below).
- `sections` — Ordered list of metaobject references (each one must be a section).

Section metaobject (`mobile_home_section`):
- Common fields: `kind`, `title`, `subtitle`, `url` (or `link`), `theme`, `country`, `language`, `startAt`, `endAt`.
- Global field: `size` — choose `small`, `medium` (default), or `large` to control how much vertical space the section occupies.
- Kind fields: images (`image`, `image2`, `image3`…), `speed`, `align`, `background`, `foreground`, `count`, `collection`, etc.
- The service accepts `foo2` or `foo_2` style suffixes for second/third items (`image2`, `image_2`, …).

---

## Handles & Page Mapping

| App screen | Handle loaded | Notes |
| --- | --- | --- |
| Home tab | `app-home` (default) | Changeable via `useMobileHome("<handle>")`. |
| Men landing | `men-home` | Configured in `app/pages/[handle].tsx`. |
| Women landing | `women-home` | Same setup as Men. |

You can create additional handles (e.g. `ramadan-home`, `summer-home`) and route to them explicitly.

---

## Step‑By‑Step Setup

1. **Create the Home container metaobject**
   - Shopify Admin → Settings → Custom data → Metaobjects → Add definition.
   - Name: *Mobile Home*, Type/API ID: `mobile_home`.
   - Add field `sections` = List of *Metaobject reference* (allow multiple).

2. **Create individual Home entries**
   - Add an entry per landing (`app-home`, `men-home`, `women-home`, etc.).
   - Populate the `sections` list with references to the section entries you create next. Order matters.

3. **Create the Section metaobject definition**
   - Name: *Mobile Home Section*, Type/API ID: `mobile_home_section` (ID can differ; field keys matter).
   - Include the following fields so every kind has what it needs:
     - `kind` — Single line text (required).
     - `title`, `subtitle` — Single line text.
     - `url`, `link`, `url2`, `link2`, `url3`, `link3` — URL.
     - `theme`, `country`, `language`, `align`, `layout`, `background`, `foreground`, `eyebrow` — Single line text.
     - `startAt`, `endAt` — Date and time.
     - `speed`, `count` — Number.
     - `image`, `image2`, `image3`, `image4`, `image5`, `image6` — File (Media image).
     - `collection` — Reference → Collection.

4. **Create section entries**
   - Add a `mobile_home_section` entry per row/feature you need.
   - Set the `kind`, fill in the fields listed for that kind below, and attach each entry to the `sections` list of the desired landing handle.

---

## Supported Section Kinds

All sections respect the optional targeting/scheduling fields: `country`, `language`, `startAt`, `endAt`. When blank, they render globally and immediately.

### `hero_poster`
- Purpose: Full-bleed hero card.
- Required: `image`.
- Optional: `title`, `url`, `theme` (`light` default; accepts `dark`), plus common gating fields.

### `headline_promo`
- Purpose: Bold typographic headline that can deep-link.
- Required: `title`.
- Optional: `url`, `theme`, gating fields.

### `ribbon_marquee`
- Purpose: Animated marquee ribbon.
- Required: `title` (or `subtitle` if you prefer to keep `title` empty).
- Optional: `speed` (number, px/s, default 30), `theme`, `url`, gating fields.

### `split_banner`
- Purpose: Single hero with scrim and optional CTA alignment.
- Required: `image`.
- Optional: `title`, `url`, `align` (`left` default; accepts `center`, `right`), `theme`, gating fields.

### `poster_triptych`
- Purpose: Up to six stacked posters rendered in a 3-up layout.
- Required: At least one populated item (`image` or text).
- Optional fields per item (`image`, `image2`, …):
  - `title`, `subtitle`, `eyebrow`, `url`/`link`, `background`, `foreground`, `align`, `layout`.
- Global optional fields: `count` (number of items to read, default 3, max 6), `theme`, gating fields.
- Layout hints (`layout`) accept values like `portrait`, `wide`, `square`, `tall`.

### `poster_quilt`
- Purpose: Quilt grid (two rows, statement tile).
- Required: Populate at least one item.
- Optional per item (same keys as triptych).
- Global optional fields: `count` (default 5, capped at 6), `theme`, gating fields.
- Layout suggestions: `portrait`, `landscape`, `banner`, `statement`, `square`.

### `image_carousel`
- Purpose: Auto-advancing hero carousel that also supports manual swipes.
- Required: At least one tile with an image.
- Optional per item: `url`/`link` for tap-through navigation.
- Global optional fields: `count` (default 5, max 10), `height` (px), `theme`, gating fields.
- Slides auto-advance every 4.5 seconds when untouched.

### `image_link_slider`
- Purpose: Horizontally scrolling row of tappable images with tiny captions.
- Required: Populate at least one tile with `image` (`image2`, `image3`, ... are supported).
- Optional per item: `title`/`title2` (caption text shown on the white tag), `url`/`link` for the tap-through destination.
- Optional global fields: `count` (default 8, max 12), `title`/`subtitle`/`heading` for an optional section label, `theme`, gating fields.
- Each image gently scales to ~1.03× while pressed and displays its caption in a centered white rectangle with black text.
- Alias: The kind name `image_slider_link` also works if you already created a definition with that identifier.

### `duo_poster`
- Purpose: Two half-width posters.
- Required: `image` (left), `image2` (right).
- Optional: `url` (left), `url2`/`link2` (right), gating fields.

### `brand_cloud`
- Purpose: Interactive brand tag cloud sourced from the storefront vendor index.
- Optional: `title`, gating fields.
- No images or links stored on the section—the component fetches brands dynamically. Navigation uses the tapped brand’s URL.

### `trio_grid`
- Purpose: Three-tile grid.
- Required: `image`, `image2`, `image3`.
- Optional: `url`, `url2`/`link2`, `url3`/`link3`, gating fields.

### `product_rail`
- Purpose: Horizontal carousel of products from a collection.
- Required: `collection` (reference to a Shopify collection; the app reads the handle).
- Optional: `title`, `theme`, gating fields.

### `editorial_quote`
- Purpose: Large typographic quotation/promo.
- Required: `title` (quote text).
- Optional: `url`, `theme`, gating fields.

---

## Targeting and Scheduling

Sections are filtered before rendering:
- If `country` is set and does not match the current locale (`currentLocale().country`), the section is hidden.
- If `language` is set and differs from the active language (`EN`/`AR`), the section is hidden.
- `startAt`/`endAt` gate the section to a specific time window (ISO timestamps).

---

## Ordering, Variants, and Reuse

- The `sections` list order is exactly how sections appear in the app.
- You can create multiple `mobile_home` entries for A/B tests or seasonal takeovers and load them by handle.
- Unknown kinds or references that are not metaobjects are ignored gracefully, so you can stage future content without breaking the page.

---

## Images & Accessibility

- Use Media Images for all `image` fields so Shopify returns optimized URLs and alt text.
- Alt text is managed on the Media object; the app reuses it when available.
- Maintain consistent aspect ratios: heroes wide, triptych mostly portrait, quilts mixed (`layout` hint controls aspect).

---

## Quick Build Example

1. Create `mobile_home_section` entries:
   - `hero_poster` with `title`, `image`, `url`.
   - `product_rail` with `title`, `collection`.
   - `poster_triptych` with three images and URLs.
2. Add them in order to the `sections` list on the `app-home` metaobject entry.
3. Duplicate the process for `men-home`/`women-home` handles if needed.

---

## Troubleshooting

- **Nothing renders**: Confirm the handle exists, `sections` is populated with metaobject references, and each entry has a supported `kind`.
- **Section missing**: Check locale filters (`country`, `language`) and scheduling (`startAt`, `endAt`).
- **Product rail empty**: Ensure the referenced collection is published to the Storefront API.
- **Broken images**: Verify field keys (`image`, `image2`, …) are spelled exactly and point to Media images.
- **Triptych/quilt layout looks odd**: Adjust `layout`, `background`, or `foreground` per tile to match creative intent.

---

## Appendix — Field Key Reference

- Common: `kind`, `title`, `subtitle`, `url`/`link`, `theme`, `country`, `language`, `startAt`, `endAt`.
- Media: `image`, `image2`, `image3`, `image4`, `image5`, `image6` (suffix `_2` style also accepted).
- URLs: `url2`/`link2`, `url3`/`link3`.
- Styling: `align`, `layout`, `background`, `foreground`, `eyebrow`, `theme`.
- Lists: `count` (triptych/quilt/carousel item count), `speed` (marquee speed).
- Carousel: `height` (pixel height override).
- Commerce: `collection` (collection reference for `product_rail`).
- Container: `sections` (on `mobile_home`).

This guide mirrors the logic in `lib/shopify/services/home.ts`, ensuring the listed keys are exactly what the app reads at runtime.
