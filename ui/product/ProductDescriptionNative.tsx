import { DEFAULT_PLACEHOLDER, optimizeImageUrl } from "@/lib/images/optimize"
import { Skeleton } from "@/ui/feedback/Skeleton"
import { Image as ExpoImage } from "expo-image"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PixelRatio, View, useWindowDimensions } from "react-native"
import RenderHTML from "react-native-render-html"

type Props = { html?: string; onReady?: () => void }

function sanitizeHTML(html: string): string {
  if (!html) return html
  let out = html
  // Remove scripts, styles, iframes, and comments
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
  out = out.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
  out = out.replace(/<!--([\s\S]*?)-->/g, "")
  // Drop empty paragraphs and multiple BRs
  out = out.replace(/<p>(?:\s|&nbsp;|<br\s*\/??>)*<\/p>/gi, "")
  out = out.replace(/(?:<br\s*\/??>\s*){3,}/gi, "<br />\n")
  // Remove inline width/height on images
  out = out.replace(/\s(?:width|height)="\d+%?"/gi, "")
  // Remove known spacer/blank pixels or empty src images which render as empty boxes
  out = out.replace(/<img[^>]+src=["']\s*["'][^>]*>/gi, "")
  out = out.replace(/<img[^>]+src=["'][^"']*(spacer|transparent|blank|pixel)[^"']*["'][^>]*>/gi, "")
  out = out.replace(/<img[^>]+src=["']data:image\/gif;base64,[^"']+["'][^>]*>/gi, "")
  // Remove empty figures left behind
  out = out.replace(/<figure>(?:\s|&nbsp;)*<\/figure>/gi, "")
  // Remove empty bordered boxes (common in pasted HTML)
  out = out.replace(
    /<(div|span|p)[^>]*style=\"[^\"]*(?:border[^;\"]*;)[^\"]*(?:height\s*:\s*\d+px)[^\"]*\"[^>]*>\s*<\/\1>/gi,
    "",
  )
  // Remove empty anchors
  out = out.replace(/<a[^>]*>\s*<\/a>/gi, "")
  return out.trim()
}

function rewriteImgSrcs(html: string, width: number, dpr: number): string {
  if (!html) return html
  return html.replace(/<img([^>]+)src=\"([^\"]+)\"([^>]*)>/gi, (m, pre, src, post) => {
    const norm = src.startsWith("//") ? `https:${src}` : src
    const optimized = optimizeImageUrl(norm, { width, format: "webp", dpr }) || norm
    // Ensure responsive sizing; RN RenderHTML supports percent width when enabled
    const cleanedPre = String(pre || "").replace(/\s(?:width|height)="[^"]*"/gi, "")
    const cleanedPost = String(post || "").replace(/\s(?:width|height)="[^"]*"/gi, "")
    return `<img${cleanedPre}src=\"${optimized}\"${cleanedPost}>`
  })
}

function normalizeSrc(src?: string) {
  if (!src) return src
  if (src.startsWith("//")) return `https:${src}`
  return src
}

function pickSrcFromSet(srcset?: string) {
  if (!srcset) return undefined
  const parts = srcset
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return undefined
  const last = parts[parts.length - 1]
  return last.split(" ")[0]
}

function HtmlImg({
  src,
  widthHint,
  heightHint,
  contentW,
  dpr,
  onEnd,
}: {
  src: string
  widthHint?: number
  heightHint?: number
  contentW: number
  dpr: number
  onEnd: () => void
}) {
  const norm = normalizeSrc(src) || ""
  const first = optimizeImageUrl(norm, { width: Math.round(contentW), format: "webp", dpr }) || norm
  const candidates = [first, norm, src].filter(Boolean) as string[]
  const [idx, setIdx] = useState(0)
  const uri = candidates[Math.min(idx, candidates.length - 1)]
  const ratio = widthHint && heightHint && widthHint > 0 && heightHint > 0 ? widthHint / heightHint : 4 / 3
  return (
    <ExpoImage
      source={{ uri }}
      style={{ width: "100%", aspectRatio: ratio, borderRadius: 8 }}
      contentFit="contain"
      cachePolicy="disk"
      transition={0}
      placeholder={DEFAULT_PLACEHOLDER}
      onError={() => setIdx((i) => i + 1)}
      onLoadEnd={onEnd}
    />
  )
}

export default function ProductDescriptionNative({ html = "", onReady }: Props) {
  const [measured, setMeasured] = useState(false)
  const { width: screenW } = useWindowDimensions()
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const contentW = Math.max(320, Math.min(screenW - 32, screenW))

  const processed = useMemo(() => {
    const clean = sanitizeHTML(html)
    return rewriteImgSrcs(clean, Math.round(contentW), dpr)
  }, [html, contentW, dpr])

  // Track img loads and keep skeleton until everything is ready (with a safety timeout)
  const imgCount = useMemo(() => (processed.match(/<img[^>]+src=/gi) || []).length, [processed])
  const [showSkeleton, setShowSkeleton] = useState(true)
  const loadedImagesRef = useRef(0)
  useEffect(() => {
    loadedImagesRef.current = 0
    setShowSkeleton(true)
    const timeout = setTimeout(
      () => {
        setShowSkeleton(false)
        onReady?.()
      },
      Math.min(5000, 1200 + imgCount * 350),
    )
    return () => clearTimeout(timeout)
  }, [imgCount, processed])
  useEffect(() => {
    if (imgCount === 0) {
      setShowSkeleton(false)
      onReady?.()
    }
  }, [imgCount, onReady])

  const onImgEnd = useCallback(() => {
    loadedImagesRef.current += 1
    if (loadedImagesRef.current >= imgCount) {
      setShowSkeleton(false)
      onReady?.()
    }
  }, [imgCount, onReady])

  const domVisitors = useMemo(
    () => ({
      onElement: (element: any) => {
        if (element.name === "img") {
          const srcset = element.attribs?.srcset as string | undefined
          const dataSrc =
            (element.attribs?.["data-src"] as string | undefined) ||
            (element.attribs?.["data-original"] as string | undefined)
          if ((!element.attribs?.src || element.attribs?.src === "") && (dataSrc || srcset)) {
            const fromSet = pickSrcFromSet(srcset)
            element.attribs.src = normalizeSrc(fromSet || dataSrc || "") as any
          } else if (element.attribs?.src) {
            element.attribs.src = normalizeSrc(String(element.attribs.src)) as any
          }
          const src = (element.attribs?.src || "").trim()
          const style = String(element.attribs?.style || "")
          const wAttr = parseInt(String(element.attribs?.width || ""), 10)
          const hAttr = parseInt(String(element.attribs?.height || ""), 10)
          const wStyle = /width\s*:\s*(\d+)px/i.exec(style)?.[1]
          const hStyle = /height\s*:\s*(\d+)px/i.exec(style)?.[1]
          const dims = [wAttr, hAttr, Number(wStyle), Number(hStyle)].filter((v) => Number(v) > 0)
          const tooSmall = dims.length >= 2 && dims.every((v) => Number(v) <= 2)
          if (
            !src ||
            /spacer|transparent|blank|pixel|clear\.gif/i.test(src) ||
            /^data:image\/gif;base64/i.test(src) ||
            tooSmall
          ) {
            ;(element as any).parent?.children?.splice(
              (element as any).parent.children.indexOf(element as any),
              1,
            )
          }
        }
      },
    }),
    [],
  )

  const renderers = useMemo(
    () => ({
      img: ({ tnode }: any) => {
        const src: string = String(tnode?.domNode?.attribs?.src || "")
        const wAttr = parseInt(String(tnode?.domNode?.attribs?.width || ""), 10)
        const hAttr = parseInt(String(tnode?.domNode?.attribs?.height || ""), 10)
        return (
          <HtmlImg
            src={src}
            widthHint={wAttr}
            heightHint={hAttr}
            contentW={contentW}
            dpr={dpr}
            onEnd={onImgEnd}
          />
        )
      },
    }),
    [contentW, dpr, onImgEnd],
  )

  const tagsStyles = useMemo(
    () => ({
      p: { lineHeight: 22, fontSize: 15, color: "#444" },
      img: { borderRadius: 8 },
      ul: { paddingLeft: 18 },
      ol: { paddingLeft: 18 },
      table: { borderWidth: 1, borderColor: "#e6e6e6" },
      td: { borderWidth: 1, borderColor: "#e6e6e6", paddingHorizontal: 8, paddingVertical: 6 },
      th: { borderWidth: 1, borderColor: "#e6e6e6", paddingHorizontal: 8, paddingVertical: 6 },
      h1: { fontSize: 22 },
      h2: { fontSize: 18 },
      h3: { fontSize: 16 },
      body: { color: "#0B0B0B" },
    }),
    [],
  )

  const renderersProps = useMemo(() => ({ img: { enableExperimentalPercentWidth: true } }), [])
  const renderSource = useMemo(() => ({ html: processed }), [processed])

  return (
    <View
      style={{ width: "100%", position: "relative" }}
      onLayout={() => {
        if (!measured) {
          setMeasured(true)
          onReady?.()
        }
      }}
    >
      {showSkeleton ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, top: 0, paddingTop: 0, backgroundColor: "#FFFFFF" }}
        >
          <View style={{ gap: 8, paddingBottom: 8 }}>
            <Skeleton style={{ height: 14, width: "80%", borderRadius: 6 }} />
            <Skeleton style={{ height: 14, width: "60%", borderRadius: 6 }} />
            <Skeleton style={{ height: 180, width: "100%", borderRadius: 12 }} />
          </View>
        </View>
      ) : (
        <RenderHTML
          source={renderSource}
          contentWidth={contentW}
          enableExperimentalBRCollapsing
          defaultTextProps={{ selectable: false }}
          domVisitors={domVisitors as any}
          renderers={renderers as any}
          renderersProps={renderersProps as any}
          tagsStyles={tagsStyles as any}
          ignoredDomTags={["map"]}
        />
      )}
    </View>
  )
}
