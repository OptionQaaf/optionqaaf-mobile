export function getOrderStatusStyle(status?: string | null) {
  const normalized = (status ?? "").toUpperCase()
  const label = formatStatus(status)
  const map: Record<string, { bg: string; color: string }> = {
    FULFILLED: { bg: "#dcfce7", color: "#166534" },
    PARTIALLY_FULFILLED: { bg: "#fef3c7", color: "#92400e" },
    IN_PROGRESS: { bg: "#dbeafe", color: "#1d4ed8" },
    PENDING_FULFILLMENT: { bg: "#dbeafe", color: "#1d4ed8" },
    UNFULFILLED: { bg: "#f3f4f6", color: "#1f2937" },
    ON_HOLD: { bg: "#fef9c3", color: "#92400e" },
    RESTOCKED: { bg: "#ede9fe", color: "#5b21b6" },
    SCHEDULED: { bg: "#ede9fe", color: "#5b21b6" },
    OPEN: { bg: "#f3f4f6", color: "#1f2937" },
    SUCCESS: { bg: "#dcfce7", color: "#166534" },
    CANCELLED: { bg: "#fee2e2", color: "#b91c1c" },
    FAILURE: { bg: "#fee2e2", color: "#b91c1c" },
    ERROR: { bg: "#fee2e2", color: "#b91c1c" },
    PENDING: { bg: "#fef3c7", color: "#92400e" },
  }
  const style = map[normalized] ?? { bg: "#e2e8f0", color: "#475569" }
  return { label, ...style }
}

function formatStatus(value?: string | null): string {
  if (!value) return "Processing"
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
