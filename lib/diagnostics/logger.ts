export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogContext = Record<string, unknown>

export type LogEntry = {
  id: number
  at: string
  level: LogLevel
  scope: string
  message: string
  context?: LogContext
}

const MAX_LOG_ENTRIES = 800

let nextLogId = 1
const logEntries: LogEntry[] = []

function toLogContext(input?: unknown): LogContext | undefined {
  if (input == null) return undefined

  if (input instanceof Error) {
    return {
      name: input.name,
      message: input.message,
      stack: input.stack ?? null,
    }
  }

  if (typeof input !== "object") {
    return { value: input }
  }

  return input as LogContext
}

function pushEntry(level: LogLevel, scope: string, message: string, context?: unknown): void {
  if (level === "debug" && (typeof __DEV__ === "undefined" || !__DEV__)) return

  logEntries.push({
    id: nextLogId,
    at: new Date().toISOString(),
    level,
    scope,
    message,
    context: toLogContext(context),
  })
  nextLogId += 1

  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.splice(0, logEntries.length - MAX_LOG_ENTRIES)
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, context?: unknown): void => pushEntry("debug", scope, message, context),
    info: (message: string, context?: unknown): void => pushEntry("info", scope, message, context),
    warn: (message: string, context?: unknown): void => pushEntry("warn", scope, message, context),
    error: (message: string, context?: unknown): void => pushEntry("error", scope, message, context),
  }
}

export function getLogs(scopePrefix?: string): LogEntry[] {
  if (!scopePrefix) return logEntries.slice()
  return logEntries.filter((entry) => entry.scope.startsWith(scopePrefix))
}

export function clearLogs(scopePrefix?: string): void {
  if (!scopePrefix) {
    logEntries.length = 0
    return
  }

  const keep = logEntries.filter((entry) => !entry.scope.startsWith(scopePrefix))
  logEntries.length = 0
  logEntries.push(...keep)
}
