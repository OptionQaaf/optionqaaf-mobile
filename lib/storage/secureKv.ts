import * as SecureStore from "expo-secure-store"

import { kv } from "./mmkv"

const hasSecure = Boolean(SecureStore && typeof SecureStore.setItemAsync === "function")

export const secureKv = {
  get: async (key: string): Promise<string | null> => {
    if (hasSecure) {
      try {
        const value = await SecureStore.getItemAsync(key)
        return value ?? null
      } catch {
        // fall through to mmkv fallback
      }
    }
    const value = kv.get(key)
    return value ?? null
  },
  set: async (key: string, value: string): Promise<void> => {
    if (hasSecure) {
      try {
        await SecureStore.setItemAsync(key, value)
        return
      } catch {
        // fall through to mmkv fallback
      }
    }
    kv.set(key, value)
  },
  del: async (key: string): Promise<void> => {
    if (hasSecure) {
      try {
        await SecureStore.deleteItemAsync(key)
        return
      } catch {
        // fall through to mmkv fallback
      }
    }
    kv.del(key)
  },
}
