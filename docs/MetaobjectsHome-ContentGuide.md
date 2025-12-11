# OptionQaaf Home Pages — Content Setup Guide

This guide is for merchandisers, marketers, and anyone updating the Home, Men, or Women landing pages in Shopify. No coding is needed — just follow the steps below.

---

## 1. What You Need Before You Start
- Shopify admin access with permission to edit **Metaobjects** and **Collections**.
- Images (uploaded to Shopify Files or Products) with alt text ready.
- Links you want each tile or banner to open.
- Launch details if you plan to target a country, language, or date range.

---

## 2. Quick Vocabulary
- **Metaobject**: A reusable content block in Shopify. We use two types:
  - `mobile_home`: the overall page (Home, Men, Women).
  - `mobile_home_section`: each individual block (hero, product rail, etc.).
- **Handle**: The unique name for each page. Example: `app-home`, `men-home`, `women-home`.
- **Section kind**: The layout style. You choose a kind (e.g. `hero_poster`), then fill in the fields it needs.

---

## 3. Page Handles You Can Edit

| Page in the app | Handle in Shopify | Notes |
| --- | --- | --- |
| Home tab | `app-home` | Main landing page everyone sees. |
| Men landing | `men-home` | Used on the Men collection screen. |
| Women landing | `women-home` | Used on the Women collection screen. |

You can create seasonal versions (e.g. `ramadan-home`) and share the handle with the dev team if it needs to go live.

---

## 4. Step-by-Step: Updating a Page

1. **Open Metaobjects**  
   Shopify Admin → *Content* → *Metaobjects* → find **Mobile Home**.

2. **Pick the page handle**  
   Open `app-home`, `men-home`, or `women-home`.

3. **Review the section list**  
   - Sections render top to bottom in the same order.
   - Drag to reorder. Use the ⋮⋮ handle on the left of each row.

4. **Edit an existing section**  
   - Click the section entry name.
   - Update the fields listed in section 5.
   - Click **Save** and go back.

5. **Add a new section**  
   - From the page entry, click **Add section**.
   - Choose **Create** → **Mobile Home Section**.
   - Fill in the fields (see section 5) and save.
   - Back on the page, drag it into the correct position.

6. **Remove a section**  
   - In the section list, click the ⋯ menu → **Remove reference**.  
   - The section entry stays in Shopify in case you want to reuse it later.

7. **Set live timing (optional)**  
   - Open the section entry.
   - Use `startAt` and `endAt` (date & time) if it should appear only for a set period.
   - Use `country` (SA, AE, …) or `language` (EN, AR) for targeting. Leave blank to show everywhere.

---

## 5. Section Library & Checklists

Use the “Kind” dropdown in your section to select one of the layouts below. Every section also has a **Size** dropdown (Small / Medium / Large) that scales the height/spacing of the block in the app. Leave it on **Medium** unless you explicitly want a compact or oversized treatment.

### Hero Poster — `hero_poster`
Best for a main campaign image.
- ✅ Required: hero image.
- ➕ Optional: headline (`title`), click-through link (`url`), theme (`light` or `dark`).

### Headline Promo — `headline_promo`
Large typographic message.
- ✅ Required: headline (`title`).
- ➕ Optional: link (`url`), theme.

### Ribbon Marquee — `ribbon_marquee`
Scrolling ticker banner.
- ✅ Required: text (`title` or `subtitle`).
- ➕ Optional: speed (number, default 30), link, theme.

### Split Banner — `split_banner`
Image with copy overlay and optional CTA arrow.
- ✅ Required: banner image.
- ➕ Optional: headline (`title`), link (`url`), alignment (`align`: left/center/right), theme.
- Extras: `eyebrow`, `ctaLabel`, tint strength (`tint`), uppercase toggle (`uppercaseTitle`).

### Poster Triptych — `poster_triptych`
Three to six vertical tiles.
- ✅ Required: at least one tile with an image or text.
- For each tile use `image`, `title`, `subtitle`, `url`, `eyebrow`, `background`, `foreground`, `layout` (portrait/wide/square).
- ⚙️ `count` controls how many tiles load (default 3, max 6).

### Poster Quilt — `poster_quilt`
Two-row grid with one highlight tile.
- ✅ Required: at least one tile.
- Same fields as Triptych (`image`, `title`, etc.).
- ⚙️ `count` default 5, max 6. Layout hints: `portrait`, `landscape`, `banner`, `statement`, `square`.

### Image Carousel — `image_carousel`
Swipeable image carousel that also auto-advances every ~4.5s if untouched.
- ✅ Required: at least one tile with an image.
- ➕ Optional per tile: link (`url`/`link`) for navigation.
- ⚙️ Optional controls: `count` (number of tiles to read, default 5, max 10), `height` (pixel height of the carousel).

### Duo Poster — `duo_poster`
Side-by-side half-width images.
- ✅ Required: left image (`image`), right image (`image2`).
- ➕ Optional: titles as a list (`title`, `title2`) plus matching subtitles (`subtitle`, `subtitle2`), left link (`url`), right link (`url2` or `link2`).

### Trio Grid — `trio_grid`
Three equal tiles in one row.
- ✅ Required: three images (`image`, `image2`, `image3`).
- ➕ Optional: matching links (`url`, `url2`, `url3`).

### Product Rail — `product_rail`
Scrollable product carousel.
- ✅ Required: Collection reference (`collection`). Make sure the collection is published to the storefront.
- ➕ Optional: title, theme.

### Editorial Quote — `editorial_quote`
Large text quote or promo message.
- ✅ Required: quote text (`title`).
- ➕ Optional: link, theme.

### Brand Cloud — `brand_cloud`
Interactive list of brands pulled automatically from Shopify.
- ➕ Optional: title.
- No images or links needed; tapping a brand uses its existing URL.

---

## 6. Targeting & Scheduling Tips
- **Country**: Use two-letter codes (SA, AE, KW…). Leave blank for all countries.
- **Language**: Use `EN` or `AR`. Leave blank for both languages.
- **Start / End time**: Type dates in the format `2024-03-10T08:00`. Shopify shows a date picker.
- If a section doesn’t show up, double-check these fields first.

---

## 7. Final Checks Before Publish
- Preview the page after each major update (Shopify → View store → open the mobile app or staging environment).
- Confirm links go to the right screen.
- Ensure images have alt text (edit in Shopify Files or Products).
- Let the dev team know if you create a brand new handle so they can wire it up in the app.

---

Need help? Reach out in the #content-support channel with the section kind and a link to the Shopify entry so the team can assist quickly.
