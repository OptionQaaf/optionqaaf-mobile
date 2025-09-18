import React, { useMemo, useState } from "react"
import { View, PixelRatio, useWindowDimensions } from "react-native"
import { WebView } from "react-native-webview"
import { optimizeImageUrl } from "@/lib/images/optimize"

type Props = { html?: string }

function rewriteImgSrcs(html: string, width: number, dpr: number): string {
  if (!html) return html
  // Simple replacement for <img src="..."> occurrences.
  return html.replace(/<img([^>]+)src="([^"]+)"([^>]*)>/gi, (m, pre, src, post) => {
    const optimized = optimizeImageUrl(src, { width, format: "webp", dpr }) || src
    // Use eager loading to ensure images load even while accordion is closed/hidden
    const extras = ` loading="eager" decoding="async" style="max-width:100%;width:100%;height:auto;display:block" `
    return `<img${pre}src="${optimized}"${extras}${post}>`
  })
}

export function ProductDescription({ html = "" }: Props) {
  const [availW, setAvailW] = useState(0)
  const { width: screenW } = useWindowDimensions()
  const dpr = Math.min(3, Math.max(1, PixelRatio.get?.() ?? 1))
  const fallbackW = Math.max(320, Math.min(screenW - 32, screenW))
  const contentW = availW > 0 ? availW : fallbackW
  const processed = useMemo(
    () => (contentW > 0 ? rewriteImgSrcs(html, Math.round(contentW), dpr) : html),
    [html, contentW, dpr],
  )

  const [h, setH] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const srcDoc = `<!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      <style>
        * { box-sizing: border-box; }
        body { margin:0; padding:0; font-family: -apple-system, system-ui, 'Helvetica Neue', Arial; color: #0B0B0B; }
        .wrap { padding: 0; width: 100%; }
        p { line-height: 1.45; font-size: 15px; color: #444; }
        img, figure { max-width: 100%; width: 100%; height: auto; border-radius: 8px; display: block; }
        ul, ol { padding-left: 18px; }
        h1 { font-size: 22px; }
        h2 { font-size: 18px; }
        h3 { font-size: 16px; }
        table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; }
        td, th { border: 1px solid #e6e6e6; padding: 6px 8px; }
        a { color: #8E1A26; text-decoration: none; }
      </style>
      <script>
        function postH(){
          const h = document.documentElement.scrollHeight || document.body.scrollHeight;
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(String(h));
        }
        window.addEventListener('load', postH);
        window.addEventListener('resize', postH);
        const ro = new ResizeObserver(postH); ro.observe(document.body);
        setInterval(postH, 400);
      </script>
    </head>
    <body>
      <div class="wrap">${processed}</div>
    </body>
  </html>`

  return (
    <View style={{ width: "100%" }} onLayout={(e) => setAvailW(Math.round(e.nativeEvent.layout.width))}>
      {!loaded ? (
        <View style={{ gap: 8 }}>
          <View style={{ height: 14, width: "80%", backgroundColor: "#E5E7EB", borderRadius: 6 }} />
          <View style={{ height: 14, width: "60%", backgroundColor: "#E5E7EB", borderRadius: 6 }} />
          <View style={{ height: 180, width: "100%", backgroundColor: "#E5E7EB", borderRadius: 12 }} />
        </View>
      ) : null}
      {contentW > 0 ? (
        <WebView
          originWhitelist={["*"]}
          source={{ html: srcDoc }}
          injectedJavaScript={`setTimeout(function(){try{var h=document.documentElement.scrollHeight||document.body.scrollHeight;window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(String(h));}catch(e){}},60);true;`}
          onMessage={(e) => {
            const next = Number(e.nativeEvent.data)
            if (Number.isFinite(next) && next > 0) {
              setH(next)
              if (!loaded && next > 20) setLoaded(true)
            }
          }}
          onLoadEnd={() => setLoaded((v) => v || false)}
          style={{ width: "100%", height: h, backgroundColor: "transparent" }}
          javaScriptEnabled
          domStorageEnabled
          automaticallyAdjustContentInsets={false}
          scrollEnabled={false}
        />
      ) : null}
    </View>
  )
}

export default ProductDescription
