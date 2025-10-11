import * as SecureStore from "expo-secure-store"

export async function sset(key: string, value: string) {
  await SecureStore.setItemAsync(key, value)
}

export async function sget(key: string) {
  return SecureStore.getItemAsync(key)
}

export async function sdel(key: string) {
  await SecureStore.deleteItemAsync(key)
}
