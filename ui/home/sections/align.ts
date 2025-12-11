import type { AlignSetting, HorizontalAlign, VerticalAlign } from "@/lib/shopify/services/home"

const horizontalValues: Record<string, HorizontalAlign> = {
  left: "left",
  center: "center",
  middle: "center",
  right: "right",
}

const verticalValues: Record<string, VerticalAlign> = {
  top: "top",
  center: "center",
  middle: "center",
  bottom: "bottom",
}

export function parseAlign(
  raw: AlignSetting | undefined,
  defaults: { horizontal: HorizontalAlign; vertical: VerticalAlign },
): { horizontal: HorizontalAlign; vertical: VerticalAlign } {
  let horizontal = defaults.horizontal
  let vertical = defaults.vertical

  if (typeof raw === "string" && raw.trim()) {
    const tokens = raw
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)

    tokens.forEach((token) => {
      if (horizontalValues[token]) horizontal = horizontalValues[token]
      if (verticalValues[token]) vertical = verticalValues[token]
    })
  }

  return { horizontal, vertical }
}
