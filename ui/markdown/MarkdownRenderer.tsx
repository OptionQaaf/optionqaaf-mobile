import { Asset } from "expo-asset"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Text, useColorScheme, View } from "react-native"
import Markdown, { type MarkdownProps } from "react-native-markdown-display"

import { cn } from "@/ui/utils/cva"

type Props = {
  source: number
  className?: string
}

type Palette = {
  text: string
  surface: string
  border: string
  brand: string
}

export function MarkdownRenderer({ source, className }: Props) {
  const [content, setContent] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const colorScheme = useColorScheme()
  const rtlAwareText = useMemo(() => ({ writingDirection: "auto" as const, textAlign: "auto" as const }), [])

  const palette = useMemo<Palette>(() => {
    const isDark = colorScheme === "dark"
    return {
      text: isDark ? "#F8F8F8" : "#0B0B0B",
      surface: isDark ? "#0F172A" : "#F4F4F5",
      border: isDark ? "#1F2937" : "#E5E7EB",
      brand: "#9A1B32",
    }
  }, [colorScheme])

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        const asset = Asset.fromModule(source)
        await asset.downloadAsync()
        const uri = asset.localUri ?? asset.uri
        const response = await fetch(uri)
        const text = await response.text()
        if (isMounted) setContent(text)
      } catch {
        if (isMounted) setError("Unable to load this content right now.")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [source])

  const markdownStyles = useMemo<MarkdownProps["style"]>(
    () => ({
      body: {
        ...rtlAwareText,
        color: palette.text,
        fontFamily: "Geist",
        fontSize: 16,
        lineHeight: 24,
      },
      heading1: {
        ...rtlAwareText,
        color: palette.text,
        fontFamily: "Geist-Bold",
        fontSize: 32,
        lineHeight: 38,
        marginBottom: 12,
        marginTop: 12,
      },
      heading2: {
        ...rtlAwareText,
        color: palette.text,
        fontFamily: "Geist-Bold",
        fontSize: 24,
        lineHeight: 32,
        marginBottom: 10,
        marginTop: 18,
      },
      heading3: {
        ...rtlAwareText,
        color: palette.text,
        fontFamily: "Geist-Bold",
        fontSize: 20,
        lineHeight: 28,
        marginBottom: 8,
        marginTop: 14,
      },
      paragraph: {
        ...rtlAwareText,
        marginTop: 0,
        marginBottom: 12,
      },
      strong: {
        ...rtlAwareText,
        color: palette.text,
        fontFamily: "Geist-Bold",
      },
      em: {
        ...rtlAwareText,
        color: palette.text,
        fontFamily: "Geist-Medium",
      },
      link: {
        ...rtlAwareText,
        color: palette.brand,
        fontFamily: "Geist-Medium",
        textDecorationLine: "underline",
      },
      bullet_list: {
        marginBottom: 12,
      },
      ordered_list: {
        marginBottom: 12,
      },
      list_item: {
        ...rtlAwareText,
        marginBottom: 8,
      },
      blockquote: {
        backgroundColor: palette.surface,
        borderLeftColor: palette.brand,
        borderLeftWidth: 4,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginVertical: 8,
      },
      code_block: {
        backgroundColor: palette.surface,
        borderRadius: 14,
        color: palette.text,
        fontFamily: "Geist-Medium",
        padding: 12,
        marginVertical: 10,
      },
      fence: {
        backgroundColor: palette.surface,
        borderRadius: 14,
        color: palette.text,
        fontFamily: "Geist-Medium",
        padding: 12,
        marginVertical: 10,
      },
      code_inline: {
        backgroundColor: palette.surface,
        color: palette.text,
        fontFamily: "Geist-Medium",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
      },
      hr: {
        borderColor: palette.border,
        borderWidth: 0.5,
        marginVertical: 16,
      },
      table: {
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 12,
        marginVertical: 12,
      },
      thead: {
        backgroundColor: palette.surface,
      },
      th: {
        color: palette.text,
        fontFamily: "Geist-Bold",
        padding: 10,
        borderColor: palette.border,
        borderWidth: 1,
      },
      tr: {
        borderColor: palette.border,
        borderWidth: 1,
      },
      td: {
        color: palette.text,
        fontFamily: "Geist",
        padding: 10,
        borderColor: palette.border,
        borderWidth: 1,
      },
    }),
    [palette, rtlAwareText],
  )

  if (loading) {
    return (
      <View className={cn("py-6 w-full items-center justify-center", className)}>
        <ActivityIndicator color={palette.brand} />
      </View>
    )
  }

  if (error) {
    return (
      <View className={cn("py-4 w-full", className)}>
        <Text className="text-primary text-base font-geist-medium">{error}</Text>
      </View>
    )
  }

  return (
    <View className={cn("w-full", className)}>
      <Markdown style={markdownStyles}>{content}</Markdown>
    </View>
  )
}
