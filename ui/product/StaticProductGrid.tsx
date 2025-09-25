// ui/product/StaticProductGrid.tsx
import React from "react"
import { LayoutChangeEvent, View } from "react-native"

export function StaticProductGrid<T>({
  data,
  columns = 2,
  gap = 0,
  onLayoutWidth, // optional callback if you want to inspect width
  renderItem,
}: {
  data: T[]
  columns?: 1 | 2
  gap?: number
  onLayoutWidth?: (w: number) => void
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

  return (
    <View onLayout={onLayout}>
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
              return item ? (
                <View
                  key={i}
                  style={{
                    width: itemWidth,
                    marginRight: c < columns - 1 ? gap : 0,
                    alignSelf: "stretch",
                  }}
                >
                  {renderItem(item, itemWidth, i)}
                </View>
              ) : (
                <View key={`spacer-${c}`} style={{ width: itemWidth }} />
              )
            })}
          </View>
        ))}
    </View>
  )
}
