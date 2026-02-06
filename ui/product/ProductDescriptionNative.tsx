import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { Image as ExpoImage } from "expo-image"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PixelRatio, Pressable, View, useWindowDimensions } from "react-native"
import RenderHTML from "react-native-render-html"

import { shareRemoteImage } from "@/src/lib/media/shareRemoteImage"

/** ---------- small utilities ---------- */
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(n, hi))

function sanitizeHTML(html: string): string {
  if (!html) return html
  let out = html
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
  out = out.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
  out = out.replace(/<!--([\s\S]*?)-->/g, "")
  out = out.replace(/<p>(?:\s|&nbsp;|<br\s*\/??>)*<\/p>/gi, "")
  out = out.replace(/(?:<br\s*\/??>\s*){3,}/gi, "<br />\n")
  out = out.replace(/\s(?:width|height)="\d+%?"/gi, "")
  out = out.replace(/<img[^>]+src=["']\s*["'][^>]*>/gi, "")
  out = out.replace(/<img[^>]+src=["'][^"']*(spacer|transparent|blank|pixel)[^"']*["'][^>]*>/gi, "")
  out = out.replace(/<img[^>]+src=["']data:image\/gif;base64,[^"']+["'][^>]*>/gi, "")
  out = out.replace(/<figure>(?:\s|&nbsp;)*<\/figure>/gi, "")
  // Wrap tables to avoid horizontal overflow
  out = out.replace(/<table([^>]*)>/gi, `<div style="overflow-x:auto;max-width:100%"><table$1>`)
  out = out.replace(/<\/table>/gi, `</table></div>`)
  return out.trim()
}

const normalizeSrc = (s?: string) => (s?.startsWith("//") ? `https:${s}` : s || "")

function rewriteImgSrcs(html: string, width: number, dpr: number): string {
  if (!html) return html
  return html.replace(/<img([^>]+)src="([^"]*)"([^>]*)>/gi, (m, pre, rawSrc, post) => {
    const norm = normalizeSrc(rawSrc)
    const optimized = optimizeImageUrl(norm, { width, format: "webp", dpr }) || norm
    const cleanedPre = String(pre || "").replace(/\s(?:width|height)="[^"]*"/gi, "")
    const cleanedPost = String(post || "").replace(/\s(?:width|height)="[^"]*"/gi, "")
    return `<img${cleanedPre}src="${optimized}"${cleanedPost} style="max-width:100%;height:auto;display:block" />`
  })
}

/** ---------- Per‑image skeleton (no global overlay) ---------- */
function ImageWithSkeleton({
  src,
  contentW,
  dpr,
  onAnyImageSettled,
  onLongPress,
  disabled,
}: {
  src: string
  contentW: number
  dpr: number
  onAnyImageSettled: () => void
  onLongPress?: () => void
  disabled?: boolean
}) {
  // 1) Build candidates: prefer optimized, then original
  const primary = optimizeImageUrl(src, { width: Math.round(contentW), format: "webp", dpr }) || src
  const candidates = useMemo(() => Array.from(new Set([primary, src].filter(Boolean))), [primary, src])

  // 2) Show a local skeleton for THIS image only
  const [showSkel, setShowSkel] = useState(true)
  const [idx, setIdx] = useState(0)
  const uri = candidates[Math.min(idx, candidates.length - 1)]

  // 3) Reserve stable height with aspectRatio; adjust once on first load only
  const [ratio, _setRatio] = useState(4 / 3) // conservative default for product descriptions
  const ratioLocked = useRef(false)
  const setRatioOnce = (rw: number, rh: number) => {
    if (ratioLocked.current) return
    if (rw > 1 && rh > 1) {
      ratioLocked.current = true
      _setRatio(clamp(rw / rh, 0.4, 2.5))
    }
  }

  const settle = useCallback(() => {
    if (showSkel) {
      setShowSkel(false)
      onAnyImageSettled()
    }
  }, [showSkel, onAnyImageSettled])

  const interactive = Boolean(onLongPress && !disabled)
  const imageContent = (
    <>
      {/* reserved space prevents layout jump; image is always mounted */}
      <ExpoImage
        source={{ uri }}
        style={{ width: "100%", aspectRatio: ratio }}
        contentFit="contain"
        cachePolicy="disk"
        transition={0}
        placeholder={DEFAULT_PLACEHOLDER}
        onLoad={(e: any) => {
          const w = Number(e?.source?.width || 0)
          const h = Number(e?.source?.height || 0)
          setRatioOnce(w, h)
        }}
        onLoadEnd={settle}
        onError={() => {
          // try next candidate; if none => settle anyway (no endless waits)
          setIdx((i) => {
            const nxt = i + 1
            if (nxt >= candidates.length) settle()
            return nxt
          })
        }}
      />

      {/* local skeleton (fades away by being removed) */}
      {showSkel ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
          <View style={{ height: 12, width: "75%", marginBottom: 8, overflow: "hidden" }}>
            {/* small line looks nicer above images */}
            <ExpoImage source={{ uri: DEFAULT_PLACEHOLDER }} style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ width: "100%", aspectRatio: ratio, overflow: "hidden" }}>
            <ExpoImage source={{ uri: DEFAULT_PLACEHOLDER }} style={{ width: "100%", height: "100%" }} />
          </View>
        </View>
      ) : null}
    </>
  )

  return (
    <View style={{ width: "100%", position: "relative" }}>
      {interactive ? (
        <Pressable onLongPress={onLongPress} style={{ width: "100%", position: "relative" }}>
          {imageContent}
        </Pressable>
      ) : (
        imageContent
      )}
    </View>
  )
}

/** ---------- Main (no global overlay; text first, images hydrate) ---------- */
type Props = {
  html?: string
  onReady?: () => void
  isAdmin?: boolean
  productTitle?: string
}

function ProductDescriptionNativeBase({
  html = "",
  onReady,
  isAdmin = false,
  productTitle,
}: Props) {
  const { width: screenW } = useWindowDimensions()
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const contentW = Math.max(320, Math.min(screenW - 32, screenW))
  // clean/rewrite once per width change
  const processed = useMemo(() => {
    const clean = sanitizeHTML(html)
    return rewriteImgSrcs(clean, Math.round(contentW), dpr)
  }, [html, contentW, dpr])

  // count imgs
  const imgCount = useMemo(() => (processed.match(/<img[^>]+src=/gi) || []).length, [processed])

  // When first image settles OR after safety timeout, fire onReady once.
  const firedReady = useRef(false)
  const safeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fireReadyOnce = useCallback(() => {
    if (!firedReady.current) {
      firedReady.current = true
      onReady?.()
    }
  }, [onReady])

  useEffect(() => {
    firedReady.current = false
    if (safeTimeoutRef.current) clearTimeout(safeTimeoutRef.current)
    // text renders immediately; we just give images some time before calling onReady (for your accordion use)
    const ms = Math.min(3000, 600 + imgCount * 250)
    safeTimeoutRef.current = setTimeout(fireReadyOnce, ms)
    return () => {
      if (safeTimeoutRef.current) clearTimeout(safeTimeoutRef.current)
    }
  }, [processed, imgCount, fireReadyOnce])
  const handleImageLongPress = useCallback(
    async (imageUrl: string) => {
      if (!isAdmin || !imageUrl) return
      try {
        await shareRemoteImage({ imageUrl, title: productTitle })
      } catch (err: any) {
        console.error("Product description image share failed", err)
      }
    },
    [isAdmin, productTitle],
  )

  // custom image renderer using per‑image skeletons
  const renderers = useMemo(
    () => ({
      img: ({ tnode }: any) => {
        const raw = String(tnode?.domNode?.attribs?.src || "")
        const src = normalizeSrc(raw)
        const longPressHandler = isAdmin ? () => handleImageLongPress(src) : undefined
        return (
          <ImageWithSkeleton
            src={src}
            contentW={contentW}
            dpr={dpr}
            onAnyImageSettled={fireReadyOnce}
            onLongPress={longPressHandler}
            disabled={!isAdmin}
          />
        )
      },
    }),
    [contentW, dpr, fireReadyOnce, handleImageLongPress, isAdmin],
  )

  const tagsStyles = useMemo(
    () => ({
      body: { color: "#0B0B0B" },
      p: { lineHeight: 22, fontSize: 15, color: "#444" },
      ul: { paddingLeft: 18 },
      ol: { paddingLeft: 18 },
      h1: { fontSize: 22, marginBottom: 6 },
      h2: { fontSize: 18, marginBottom: 6 },
      h3: { fontSize: 16, marginBottom: 6 },
      table: { borderWidth: 1, borderColor: "#e6e6e6" },
      td: { borderWidth: 1, borderColor: "#e6e6e6", paddingHorizontal: 8, paddingVertical: 6 },
      th: { borderWidth: 1, borderColor: "#e6e6e6", paddingHorizontal: 8, paddingVertical: 6 },
      a: { color: "#8E1A26", textDecorationLine: "none" },
    }),
    [],
  )

  return (
    <View style={{ width: "100%" }}>
      <RenderHTML
        source={{ html: processed }}
        contentWidth={contentW}
        enableExperimentalBRCollapsing
        defaultTextProps={{ selectable: false }}
        renderers={renderers as any}
        tagsStyles={tagsStyles as any}
        // avoid surprises; RNHTML sometimes tries to handle <map> etc.
        ignoredDomTags={["map"]}
      />
    </View>
  )
}

const ProductDescriptionNative = memo(ProductDescriptionNativeBase)
export default ProductDescriptionNative
