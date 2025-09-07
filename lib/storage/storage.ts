import AsyncStorage from "@react-native-async-storage/async-storage"
import type { MMKV as MMKVType } from "react-native-mmkv"

type StorageAPI = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  del: (key: string) => Promise<void>
}

let storage: StorageAPI

try {
  const { MMKV } = require("react-native-mmkv") as { MMKV: typeof MMKVType }
  const mmkv = new MMKV({ id: "optionqaaf" })
  storage = {
    get: async (k) => mmkv.getString(k) ?? null,
    set: async (k, v) => {
      mmkv.set(k, v)
    },
    del: async (k) => {
      mmkv.delete(k)
    },
  }
} catch {
  storage = {
    get: (k) => AsyncStorage.getItem(k),
    set: (k, v) => AsyncStorage.setItem(k, v),
    del: (k) => AsyncStorage.removeItem(k),
  }
}

export const kv = storage
