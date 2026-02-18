type KV = {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
  del: (key: string) => void
}

let kv: KV

try {
  const { MMKV } = require("react-native-mmkv")
  const storage = new MMKV({ id: "optionqaaf" })
  kv = {
    get: (key) => storage.getString(key) ?? null,
    set: (key, value) => storage.set(key, value),
    del: (key) => storage.delete(key),
  }
} catch {
  const mem = new Map<string, string>()
  kv = {
    get: (key) => (mem.has(key) ? mem.get(key)! : null),
    set: (key, value) => mem.set(key, value),
    del: (key) => {
      mem.delete(key)
    },
  }
  if (__DEV__ && process.env.EXPO_PUBLIC_LOG_STORAGE_FALLBACK === "1") {
    console.warn("[storage] MMKV not available (likely Expo Go). Using in-memory fallback.")
  }
}

export { kv }
