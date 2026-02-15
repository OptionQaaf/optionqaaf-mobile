import { pruneForYouProfile, type ForYouProfile } from "@/features/for-you/profile"
import { getValidAccessToken } from "@/lib/shopify/customer/auth"
import { LocalForYouProfileStorage } from "@/features/for-you/storage/localStorage"
import { ShopifyMetafieldForYouProfileStorage } from "@/features/for-you/storage/shopifyMetafieldStorage"

export type ForYouIdentity = {
  customerId: string | null
  isAuthenticated: boolean
}

export type ForYouProfileStorage = {
  getProfile: () => Promise<{ profile: ForYouProfile | null; identity: ForYouIdentity }>
  setProfile: (profile: ForYouProfile) => Promise<ForYouIdentity>
  resetProfile: () => Promise<ForYouIdentity>
}

const localStorage = new LocalForYouProfileStorage()
const remoteStorage = new ShopifyMetafieldForYouProfileStorage()
let remoteWriteDisabled = false
let remoteWriteDisableReason: string | null = null

let identityMemo: { value: ForYouIdentity; at: number } | null = null
const IDENTITY_TTL_MS = 60 * 1000

export async function resolveForYouIdentity(force = false): Promise<ForYouIdentity> {
  const now = Date.now()
  if (!force && identityMemo && now - identityMemo.at < IDENTITY_TTL_MS) return identityMemo.value

  const token = await getValidAccessToken().catch(() => null)
  if (!token) {
    const guest = { customerId: null, isAuthenticated: false }
    identityMemo = { value: guest, at: now }
    return guest
  }

  try {
    const customerId = await remoteStorage.getCustomerId()
    const identity = { customerId: customerId ?? null, isAuthenticated: Boolean(customerId) }
    identityMemo = { value: identity, at: now }
    return identity
  } catch {
    const fallback = { customerId: null, isAuthenticated: false }
    identityMemo = { value: fallback, at: now }
    return fallback
  }
}

export function forYouProfileStorageResolver(): ForYouProfileStorage {
  return {
    getProfile: async () => {
      const identity = await resolveForYouIdentity()
      const local = await localStorage.getProfile({ customerId: identity.customerId })

      if (!identity.isAuthenticated || !identity.customerId) {
        return { profile: local, identity }
      }

      try {
        const remote = await remoteStorage.getProfile()
        const remoteProfile = remote?.profile ?? null
        if (remoteProfile) {
          await localStorage.setProfile(remoteProfile, { customerId: identity.customerId })
          return {
            profile: remoteProfile,
            identity: { customerId: remote?.customerId ?? identity.customerId, isAuthenticated: true },
          }
        }
      } catch {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[for-you] remote profile read failed, using local cache fallback")
        }
        // fall back to local cache
      }

      return { profile: local, identity }
    },

    setProfile: async (profile) => {
      const pruned = pruneForYouProfile(profile)
      const identity = await resolveForYouIdentity()
      await localStorage.setProfile(pruned, { customerId: identity.customerId })

      if (identity.isAuthenticated && identity.customerId) {
        if (remoteWriteDisabled) {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.warn("[for-you] remote profile write disabled for session", remoteWriteDisableReason)
          }
          return identity
        }
        try {
          await remoteStorage.setProfile(pruned, identity.customerId)
        } catch (error: any) {
          const message = String(error?.message ?? "")
          if (message.includes("APP_NOT_AUTHORIZED")) {
            remoteWriteDisabled = true
            remoteWriteDisableReason = message
          }
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.warn(
              "[for-you] remote profile write failed, local cache remains active",
              error?.message ?? error ?? null,
            )
          }
          // local cache remains source of truth until remote is writable
        }
      }

      return identity
    },

    resetProfile: async () => {
      const identity = await resolveForYouIdentity(true)
      await localStorage.resetProfile({ customerId: identity.customerId })

      if (identity.isAuthenticated && identity.customerId) {
        try {
          await remoteStorage.resetProfile(identity.customerId)
        } catch {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.warn("[for-you] remote profile reset failed")
          }
          // best-effort reset for remote profile
        }
      }

      return identity
    },
  }
}

export { LocalForYouProfileStorage, ShopifyMetafieldForYouProfileStorage }
