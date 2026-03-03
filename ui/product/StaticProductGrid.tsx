// ui/product/StaticProductGrid.tsx
import React from "react"
import { FlashList } from "@shopify/flash-list"
import { LayoutChangeEvent, Platform, View } from "react-native"

export function StaticProductGrid<T>({
  data,
  columns = 2,
  gap = 0,
  horizontalInset = 16,
  disableVirtualization = false,
  onLayoutWidth, // optional callback if you want to inspect width
  keyExtractor,
  renderItem,
}: {
  data: T[]
  columns?: 1 | 2
  gap?: number
  horizontalInset?: number
  disableVirtualization?: boolean
  onLayoutWidth?: (w: number) => void
  keyExtractor?: (item: T, index: number) => string
  renderItem: (item: T, itemWidth: number, index: number) => React.ReactElement
}) {
  const [w, setW] = React.useState<number | null>(null)
  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width
    setW(width)
    onLayoutWidth?.(width)
  }

  const rows = Math.ceil(data.length / columns)
  const itemWidth = w == null ? 0 : Math.floor((w - gap * (columns - 1)) / columns)

  if (Platform.OS !== "web" && !disableVirtualization) {
    return (
      <View onLayout={onLayout} style={{ marginHorizontal: horizontalInset }}>
        {w != null ? (
          <FlashList
            data={data}
            numColumns={columns}
            showsVerticalScrollIndicator={false}
            keyExtractor={(item, index) =>
              item
                ? (keyExtractor?.(item, index) ??
                  String((item as any)?.id ?? (item as any)?.handle ?? (item as any)?._key ?? index))
                : `spacer-${index}`
            }
            scrollEnabled={false}
            renderItem={({ item, index }) => {
              const col = index % columns
              const isLastRow = Math.floor(index / columns) === Math.floor((data.length - 1) / columns)
              const marginBottom = isLastRow ? 0 : gap
              if (!item) {
                return (
                  <View
                    style={{
                      width: itemWidth,
                      marginRight: col < columns - 1 ? gap : 0,
                      marginBottom,
                    }}
                  />
                )
              }
              return (
                <View
                  style={{
                    width: itemWidth,
                    marginRight: col < columns - 1 ? gap : 0,
                    marginBottom,
                    alignSelf: "stretch",
                  }}
                >
                  {renderItem(item, itemWidth, index)}
                </View>
              )
            }}
          />
        ) : null}
      </View>
    )
  }

  return (
    <View onLayout={onLayout} style={{ marginHorizontal: horizontalInset }}>
      {w != null &&
        Array.from({ length: rows }).map((_, r) => (
          <View
            key={r}
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              marginBottom: r < rows - 1 ? gap : 0,
            }}
          >
            {Array.from({ length: columns }).map((__, c) => {
              const i = r * columns + c
              const item = data[i]
              const resolvedKey = item
                ? (keyExtractor?.(item, i) ??
                  String((item as any)?.id ?? (item as any)?.handle ?? (item as any)?._key ?? i))
                : null
              return item ? (
                <View
                  key={resolvedKey}
                  style={{
                    width: itemWidth,
                    marginRight: c < columns - 1 ? gap : 0,
                    alignSelf: "stretch",
                  }}
                >
                  {renderItem(item, itemWidth, i)}
                </View>
              ) : (
                <View key={`spacer-${r}-${c}`} style={{ width: itemWidth }} />
              )
            })}
          </View>
        ))}
    </View>
  )
}
