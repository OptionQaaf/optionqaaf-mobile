type CounterMap = Record<string, number>

const counters: CounterMap = {}

function enabled(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__
}

export function incrementForYouTelemetryCounter(key: string, value = 1): void {
  if (!enabled()) return
  counters[key] = (counters[key] ?? 0) + value
}

export function recordForYouTelemetryTiming(key: string, ms: number): void {
  if (!enabled()) return
  if (!Number.isFinite(ms) || ms < 0) return
  incrementForYouTelemetryCounter(`${key}.count`, 1)
  incrementForYouTelemetryCounter(`${key}.totalMs`, ms)
}

export function getForYouTelemetrySnapshot(): CounterMap {
  if (!enabled()) return {}
  return { ...counters }
}

export function logForYouTelemetry(prefix = "[for-you][telemetry]"): void {
  if (!enabled()) return
  console.debug(prefix, getForYouTelemetrySnapshot())
}
