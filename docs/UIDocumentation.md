# OptionQaaf — UI System Guide (Expo Go)

A **single, detailed reference** for every UI piece we built so far. All code is **Expo Go–safe**, uses **NativeWind**
(Tailwind classes in RN), **`@` path alias**, and the **Geist** font.

---

## Contents

1. [Design tokens & theme](#design-tokens--theme)
2. [Typography & fonts](#typography--fonts)
3. [Layout primitives](#layout-primitives)
4. [Motion & a11y utilities](#motion--a11y-utilities)
5. [Interaction utility](#interaction-utility)
6. [Core UI primitives](#core-ui-primitives)
7. [Selector / Dropdown](#selector--dropdown)
8. [Product components](#product-components)
9. [Grids (lists) without overflow](#grids-lists-without-overflow)
10. [Dev playground tooling](#dev-playground-tooling)
11. [Sticky Add-to-Cart pattern](#sticky-addto-cart-pattern)
12. [Troubleshooting & gotchas](#troubleshooting--gotchas)

---

## Design tokens & theme

**Light-first palette** (off-white app background; white cards).

> `tailwind.config.js` → `theme.extend.colors`

```js
colors: {
  // App surfaces
  base: "#F4F4F5",     // app background (off-white)
  elev: "#EEEEEF",     // light grey blocks / skeleton
  surface: "#FFFFFF",  // cards
  border: "#E5E7EB",   // dividers / strokes

  // Text
  primary: "#0B0B0B",  // near-black text
  secondary: "#525252",
  muted: "#8A8A8A",

  // Brand
  brand: "#8F1D2C",       // maroon
  brandAccent: "#B0283D", // pressed/hover tint

  // States
  success: "#16A34A",
  warning: "#F59E0B",
  danger:  "#DC2626",
  info:    "#2563EB",
}
```

**Naming rules (what you use in classnames):**

- Backgrounds: `bg-base` (screen), `bg-surface` (cards), `bg-elev` (skeleton).
- Borders: `border-border`.
- Text: `text-primary`, `text-secondary`, `text-muted`, `text-white`.
- Brand CTAs: `bg-brand`, pressed: `brandAccent`.

---

## Typography & fonts

**Geist** is loaded via a provider and mapped to typographic primitives.

**`theme/FontProvider.tsx`** (excerpt)

```tsx
import { useFonts } from "expo-font"
import * as SplashScreen from "expo-splash-screen"

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [loaded] = useFonts({
    "Geist-Black": require("@/assets/fonts/Geist/Geist-Black.ttf"),
    "Geist-Bold": require("@/assets/fonts/Geist/Geist-Bold.ttf"),
    "Geist-ExtraBold": require("@/assets/fonts/Geist/Geist-ExtraBold.ttf"),
    "Geist-ExtraLight": require("@/assets/fonts/Geist/Geist-ExtraLight.ttf"),
    "Geist-Light": require("@/assets/fonts/Geist/Geist-Light.ttf"),
    "Geist-Medium": require("@/assets/fonts/Geist/Geist-Medium.ttf"),
    Geist: require("@/assets/fonts/Geist/Geist-Regular.ttf"),
    "Geist-SemiBold": require("@/assets/fonts/Geist/Geist-SemiBold.ttf"),
    "Geist-Thin": require("@/assets/fonts/Geist/Geist-Thin.ttf"),
  })

  if (!loaded) return null
  return <>{children}</>
}
```

**`ui/primitives/typography.tsx`** (concept)

```tsx
import { Text as RNText, TextProps } from "react-native"
import { cn } from "@/ui/utils/cva"

export function H1({ className, ...p }: TextProps) {
  return <RNText {...p} className={cn("font-geist-bold text-primary text-[34px] leading-[40px]", className)} />
}
export function Text({ className, ...p }: TextProps) {
  return <RNText {...p} className={cn("text-primary", className)} />
}
export function Muted({ className, ...p }: TextProps) {
  return <RNText {...p} className={cn("text-muted", className)} />
}
```

---

## Layout primitives

### `Screen` — Safe area with **granular bleed**

```tsx
// ui/layout/Screen.tsx
import { SafeAreaView } from "react-native-safe-area-context"
import { View } from "react-native"

export function Screen({
  children,
  bleedTop,
  bleedBottom,
  bleedHorizontal,
}: {
  children: React.ReactNode
  bleedTop?: boolean
  bleedBottom?: boolean
  bleedHorizontal?: boolean
}) {
  const edges: Array<"top" | "bottom" | "left" | "right"> = []
  if (!bleedTop) edges.push("top")
  if (!bleedBottom) edges.push("bottom")
  if (!bleedHorizontal) {
    edges.push("left")
    edges.push("right")
  }
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-base">
      <View className="flex-1 w-full">{children}</View>
    </SafeAreaView>
  )
}
```

- Use `bleedTop` for hero images to reach the notch.
- Keep `bleedBottom` **off**; let bottom bars handle their own safe-area.

### `PageScrollView` — Page wrapper with footer + edge control

```tsx
// ui/layout/PageScrollView.tsx
<PageScrollView contentContainerStyle={{ paddingTop: 12 }}>
  <View className="px-4 gap-6">{/* page content */}</View>
</PageScrollView>
```

- Imports from `@/ui/layout/PageScrollView`.
- Applies the shared `verticalScrollProps` defaults (`ui/layout/scrollDefaults.ts`) to kill iOS bounce + Android glow
  and to keep taps alive via `keyboardShouldPersistTaps="handled"`.
- Automatically appends `AppFooter` to the scroll content so short pages still anchor to the bottom. Pass
  `FooterComponent`/`footerProps` if a screen needs a different footer treatment.
- For non-page scroll containers, reuse `verticalScrollProps` directly on the underlying `ScrollView`/`FlatList`.

### `AppFooter` — Legal + social section

```tsx
// ui/layout/AppFooter.tsx
<AppFooter className="mt-6" />
```

- Uses surface tokens (`bg-surface`, `border-border`) and `Container` spacing so it blends with existing cards.
- Links and brand copy resolve from `lib/config/site.ts` (`FOOTER_POLICY_LINKS`, `FOOTER_SOCIAL_LINKS`, `BRAND_NAME`).
  Update that file to change destinations in one place.
- Accepts optional `className`, `contentClassName`, and `heading` overrides for niche layouts (lists, modals, etc.).

### `Container` / `Row` / `Stack` / `Spacer`

```tsx
// ui/layout/Container.tsx
export function Container({ children, className, inset = true, ...p }: any) {
  return (
    <View {...p} className={cn("w-full self-center max-w-[1120px]", inset && "px-6", className)}>
      {children}
    </View>
  )
}

// ui/layout/Row.tsx
export function Row({ gap = "gap-3", center, between, className, ...p }: any) {
  return (
    <View
      {...p}
      className={cn("flex-row items-center", gap, center && "justify-center", between && "justify-between", className)}
    />
  )
}

// ui/layout/Stack.tsx
export function Stack({ gap = "gap-4", center, className, ...p }: any) {
  return <View {...p} className={cn("flex-col", gap, center && "items-center", className)} />
}

// ui/layout/Spacer.tsx
export const Spacer = ({ h = 12 }: { h?: number }) => <View style={{ height: h }} />
```

---

## Motion & a11y utilities

### Motion tokens & helpers

```ts
// ui/motion/motion.ts
import {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeOutDown,
  FadeInUp,
  FadeOutUp,
  LinearTransition,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated"

export const MOTION = {
  dur: { xs: 120, sm: 160, md: 220, lg: 320 },
  spring: () => LinearTransition.springify().damping(18).stiffness(180),
  linear: (ms = 160) => LinearTransition.duration(ms),
  enter: { fade: FadeIn.duration(160), fadeDown: FadeInDown.duration(160), fadeUp: FadeInUp.duration(160) },
  exit: { fade: FadeOut.duration(140), fadeDown: FadeOutDown.duration(140), fadeUp: FadeOutUp.duration(140) },
}

export function useCrossfade(show: boolean, duration = MOTION.dur.sm) {
  const v = useSharedValue(show ? 1 : 0)
  v.value = withTiming(show ? 1 : 0, { duration })
  return useAnimatedStyle(() => ({ opacity: v.value }))
}

export function usePressAnim({ scale = 0.98, dim = 0.9, duration = MOTION.dur.xs } = {}) {
  const v = useSharedValue(0)
  const onPressIn = () => (v.value = withTiming(1, { duration }))
  const onPressOut = () => (v.value = withTiming(0, { duration }))
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scale) * v.value }],
    opacity: 1 - (1 - dim) * v.value,
  }))
  return { style, onPressIn, onPressOut }
}
```

### A11y helpers

```ts
// ui/a11y/a11y.ts
import { I18nManager } from "react-native"
export const isRTL = () => I18nManager.isRTL
export const hitTarget = 10 // extra tap padding

export function a11yButton(label?: string, disabled?: boolean) {
  return {
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: label,
    accessibilityState: { disabled: !!disabled },
  }
}
export function a11yAlert() {
  return { accessible: true, accessibilityRole: "alert" as const, accessibilityLiveRegion: "polite" as const }
}
```

---

## Interaction utility

### `PressableOverlay` (scale/opacity press feedback + hitSlop)

```tsx
// ui/interactive/PressableOverlay.tsx
import { Pressable } from "react-native"
import { cn } from "@/ui/utils/cva"
import { usePressAnim } from "@/ui/motion/motion"
import { hitTarget } from "@/ui/a11y/a11y"

export function PressableOverlay({ children, className, style, disabled, onPress, hitSlop: hs }: any) {
  const { style: aStyle, onPressIn, onPressOut } = usePressAnim()
  return (
    <Pressable
      disabled={!!disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      hitSlop={hs ?? hitTarget}
    >
      <Animated.View style={aStyle} className={cn(disabled && "opacity-50", className)}>
        {children}
      </Animated.View>
    </Pressable>
  )
}
```

---

## Core UI primitives

### `Button`

- Variants: `solid` (brand), `outline`, `ghost`, `link`.
- Sizes: `sm`, `md`, `lg`.
- Props: `leftIcon`, `rightIcon`, `isLoading`, `fullWidth`, `disabled`.

```tsx
// ui/primitives/Button.tsx (excerpt)
<PressableOverlay
  {...a11yButton(typeof children === "string" ? children : undefined, disabled || isLoading)}
  disabled={disabled || isLoading}
  onPress={onPress}
  className={cn(buttonStyles({ variant, size, fullWidth, disabled }), className)}
>
  {isLoading ? <ActivityIndicator size="small" color={variant === "solid" ? "#fff" : "#0B0B0B"} /> : leftIcon}
  {typeof children === "string" ? <RNText className={labelStyles({ variant, size })}>{children}</RNText> : children}
  {rightIcon}
</PressableOverlay>
```

**Design defaults:** maroon solid, white label, rounded-xl.

---

### `Input`

- States: default, focus, error, disabled.
- Slots: `leftIcon`, `rightIcon`.
- `secureToggle` (eye icon) for passwords.

```tsx
<Input label="Email" placeholder="you@example.com" leftIcon={<Mail size={18} />} />
<Input label="Password" secureTextEntry secureToggle />
```

---

### `Card`

- Props: `padding: none|sm|md|lg`, `clip` (adds `overflow-hidden`), `elevated` via outer wrapper (shadow without
  clipping).

```tsx
<Card padding="md" clip>
  {/* …content that shouldn’t overflow rounded corners */}
</Card>
```

---

### `Badge`

```tsx
<Badge>New</Badge>
<Badge variant="brand">Maroon</Badge>
<Badge variant="success">In Stock</Badge>
```

---

### `Skeleton`

Simple pulse (opacity), use inside clipped parent to avoid corner bleed.

```tsx
<Skeleton className="h-4 w-24 rounded-md" />
```

---

### `Toast`

- Store: `useToast().show({ title, type?, duration? })`
- Host: mount **after** `<Stack />` or add `z-50`.
- Animated enter/exit; **layout transition** so items shift up on dismiss.

```tsx
// app/_layout.tsx
<FontProvider>
  <Stack screenOptions={{ headerShown: false }} />
  <ToastHost /> {/* must be after the Stack */}
</FontProvider>
```

---

## Selector / Dropdown

### `Dropdown` (bottom-sheet modal; calm fade; safe-area correct)

- Props: `label?`, `placeholder?`, `value?`, `options: {id,label,disabled?}[]`, `onChange`.
- Behaviors:
  - **Non-bouncy** (timed fade/slide), no overscroll rubber band.
  - **Safe area** on bottom + sides; list `contentContainerStyle.paddingBottom = insets.bottom + 12`.
  - **`overflow-hidden`** on rounded container so rows/separators don’t peek.

```tsx
<Dropdown
  label="Size"
  options={[
    { id: "s", label: "S" },
    { id: "m", label: "M" },
    { id: "l", label: "L" },
    { id: "xl", label: "XL", disabled: true },
  ]}
  value={size}
  onChange={setSize}
/>
```

### `VariantDropdown`

Thin wrapper around `Dropdown` with the same props.

> We also built a **chip**-style selector earlier; it’s now superseded by the Dropdown for a cleaner look.

---

## Product components

### `Price`

- Props: `amount`, `compareAt?`, `currency?="USD"`, `locale?="en-US"`.
- Shows `-xx%` when `compareAt > amount`.

```tsx
<Price amount={48} compareAt={88} currency="EUR" />
```

### `RatingStars`

- Props: `rating` (supports halves), `size`.

```tsx
<RatingStars rating={4.5} />
```

### `QuantityStepper`

- Props: `value`, `min`, `max`, `onChange`.
- Uses **tabular numerals** + **fixed minWidth** to prevent icon shift.

```tsx
<QuantityStepper value={qty} onChange={setQty} />
```

### `AddToCartBar` (sticky, **flush to bottom**)

Paint background on the **outer** absolute wrapper; place content inside a bottom `SafeAreaView`.

```tsx
<View className="absolute left-0 right-0 bottom-0 bg-surface border-t border-border">
  <SafeAreaView edges={["bottom"]}>
    <View className="px-4 py-3 flex-row items-center gap-3">
      <View className="flex-1">
        <Price amount={48} compareAt={88} />
      </View>
      <Button size="lg" className="px-6 rounded-full">
        Add to Cart
      </Button>
    </View>
  </SafeAreaView>
</View>
```

### `ImageCarousel`

- Horizontal `FlatList`, paging, dots; `height` prop; auto width via `Dimensions`.

```tsx
<ImageCarousel images={[url1, url2]} height={420} />
```

### `ProductTile`

- Props: `brand`, `title`, `price`, `compareAt?`, `currency?`, `width?`, `titleLines?`, `imageAspect?` (width/height, e.g. `3/4`),
  `rounded?` (`xl|2xl|3xl`), `padding?` (`sm|md|lg`).
- **Use `aspectRatio`** for consistent images; pass computed `width` from the grid.

```tsx
<ProductTile
  image={img}
  brand="UNIQLO"
  title="Utility Hoodie"
  price={39}
  compareAt={59}
  width={itemWidth}
  imageAspect={3 / 4}
  rounded="3xl"
  titleLines={2}
/>
```

### `SectionHeader`

Simple title + optional “See all”.

---

## Grids (lists) without overflow

### ✅ In **ScrollViews** (dev cards, small sections): use **`StaticProductGrid`**

Measures container width, renders rows without virtualization (no nested list warnings).

```tsx
<StaticProductGrid
  data={items}
  columns={2}
  gap={12}
  renderItem={(item, w) => <ProductTile {...item} width={w} imageAspect={3 / 4} />}
/>
```

### ✅ In **full pages** (PLP, PDP recs): use a page-level **`FlatList`**

- Make the page itself a `FlatList`.
- Put description/details in `ListHeaderComponent`.
- Render product items as the list rows (2 columns).
- Never nest a vertical `FlatList` inside a vertical `ScrollView`.

> If you must have a reusable virtualized grid component, use our `ProductGrid` that **measures its own container** (not
> the window), and **don’t** place it inside a `ScrollView`.

---

## Dev playground tooling

- `(dev)` route group with guard (hidden in production).
- **Story** card wrapper & **Swatch** token blocks.
- **Knobs**: `Segment` (scrollable pills), `Toggle`, `NumberKnob`.

```tsx
// app/(dev)/_layout.tsx
export default function DevLayout() {
  if (!__DEV__) return <Redirect href="/" />
  return <Stack screenOptions={{ headerShown: false }} />
}
```

---

## Sticky Add-to-Cart pattern

**Goal:** sticky while reading details, then becomes **inline** before recommendations.

**Key tricks:**

1. **Sentinel** `View` right before recommendations → measure `y`.
2. Reserve a fixed-height **inline placeholder** to avoid layout jumps.
3. **Hysteresis** (two thresholds) to prevent flicker.
4. **Cross-fade** between sticky and inline bars.

Pseudo (simplified):

```tsx
const BAR_H = 64, GAP = 12
const viewportBottom = scrollY + height - insets.bottom
const engageStickyAt = sentinelY - BAR_H - GAP
const disengageStickyAt = sentinelY - GAP

// state + hysteresis (setMode between "sticky" and "inline")
// crossfade with useCrossfade()

// Inline slot
<Animated.View style={inlineStyle} className="mx-4 mt-4 rounded-3xl bg-surface border border-border px-4 py-3">
  {/* price + button */}
</Animated.View>
<View style={{ height: BAR_H }} />

{/* Sticky */}
<Animated.View style={stickyStyle} className="absolute left-0 right-0 bottom-0">
  <AddToCartBar ... />
</Animated.View>
```

---

## Troubleshooting & gotchas

- **“VirtualizedLists should never be nested …”**  
  Don’t put `FlatList` inside a vertical `ScrollView`. Use:
  - `StaticProductGrid` (non-virtualized) for small sections **inside** ScrollViews, **or**
  - Make the page itself a `FlatList` with `ListHeaderComponent`.

- **Dropdown options overflow device bottom/curves**  
  Add `overflow-hidden` on the rounded container and set list
  `contentContainerStyle.paddingBottom = insets.bottom + 12`. Use `edges={["bottom","left","right"]}` on the
  `SafeAreaView` inside the sheet.

- **Add-to-Cart not covering bottom**  
  Paint `bg-surface border-t` on the **outer absolute wrapper**, then put content inside a bottom `SafeAreaView`. Keep
  screen `bleedBottom` **off**.

- **Pressable “icon bubble” shrinking**  
  Ensure **background/radius/padding** are applied to the **Animated.View** (the thing that scales), not the `Pressable`
  parent.

- **Skeletons bleeding past rounded corners**  
  Wrap skeletal blocks in a parent with `overflow-hidden` (or `Card` with `clip`).

- **QuantityStepper text shifts on 9→10**  
  Center it, set `minWidth` ~28, and `fontVariant: ["tabular-nums"]`.

- **Toast not visible**  
  Mount `<ToastHost />` **after** `<Stack />` or use `z-50`.  
  Auto-dismiss and layout animation:

  ```tsx
  layout={LinearTransition.springify().damping(18).stiffness(180)}
  ```

- **Reanimated layout deprecation**  
  Replace `Layout.springify()` with `LinearTransition.springify()`.

- **Segments overflowing**  
  Use a horizontally scrollable `Segment` container (`ScrollView horizontal`) with pill buttons.

---

### Conventions recap

- **Paths:** always use `@/…` (monorepo-friendly).
- **Tokens:** prefer semantic classes (`bg-base`, `text-primary`, `border-border`).
- **Motion:** use `MOTION.enter/exit/spring` across components for a consistent feel.
- **A11y:** use `a11yButton()` for pressables, `a11yAlert()` for live toasts, and `hitSlop` on tap targets.
- **Safe areas:** let **bars** handle bottom insets; let **screens** handle top/side insets; use **bleed** only where
  needed.
