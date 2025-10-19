import * as SecureStore from "expo-secure-store"

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "optionqaaf-auth",
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

export async function sset(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, OPTIONS)
}

export async function sget(key: string) {
  return SecureStore.getItemAsync(key, OPTIONS)
}

export async function sdel(key: string) {
  await SecureStore.deleteItemAsync(key, OPTIONS)
}
