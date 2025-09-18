export type OptimizeOpts = {
  width?: number
  height?: number
  format?: "webp" | "pjpg" | "jpg" | "png"
  crop?: "center" | "top" | "bottom" | "left" | "right"
  dpr?: number
}

const SHOPIFY_HOST_HINTS = ["cdn.shopify.com", "shopifycdn.net", "shopify.com"]

export function optimizeImageUrl(url?: string, opts: OptimizeOpts = {}): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    const isShopify = SHOPIFY_HOST_HINTS.some((h) => u.hostname.includes(h))
    if (!isShopify) return url

    const dpr = Math.min(3, Math.max(1, Math.round(opts.dpr ?? 1)))
    if (opts.width && Number.isFinite(opts.width)) u.searchParams.set("width", String(Math.round(opts.width * dpr)))
    if (opts.height && Number.isFinite(opts.height)) u.searchParams.set("height", String(Math.round(opts.height * dpr)))
    if (opts.format && !u.searchParams.has("format")) u.searchParams.set("format", opts.format)
    if (opts.crop) u.searchParams.set("crop", opts.crop)
    return u.toString()
  } catch {
    return url
  }
}

// Tiny 1x1 PNG (white). Gives a neutral cloudy-white placeholder while images load.
export const DEFAULT_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
