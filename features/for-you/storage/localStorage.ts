import { kv } from "@/lib/storage/storage"
import { createEmptyForYouProfile, normalizeForYouProfile, pruneForYouProfile, type ForYouProfile } from "@/features/for-you/profile"

export const FOR_YOU_LOCAL_KEY_PREFIX = "for_you.profile.v1"

export type LocalProfileScope = {
  customerId?: string | null
}

function scopedKey(scope?: LocalProfileScope): string {
  const suffix = scope?.customerId ? `customer.${scope.customerId}` : "guest"
  return `${FOR_YOU_LOCAL_KEY_PREFIX}.${suffix}`
}

export class LocalForYouProfileStorage {
  async getProfile(scope?: LocalProfileScope): Promise<ForYouProfile | null> {
    try {
      const raw = await kv.get(scopedKey(scope))
      if (!raw) return null
      return normalizeForYouProfile(JSON.parse(raw))
    } catch {
      return null
    }
  }

  async setProfile(profile: ForYouProfile, scope?: LocalProfileScope): Promise<void> {
    const normalized = pruneForYouProfile(normalizeForYouProfile(profile))
    await kv.set(scopedKey(scope), JSON.stringify(normalized))
  }

  async resetProfile(scope?: LocalProfileScope): Promise<void> {
    await kv.del(scopedKey(scope))
  }

  async ensureProfile(scope?: LocalProfileScope): Promise<ForYouProfile> {
    const existing = await this.getProfile(scope)
    if (existing) return existing
    const created = createEmptyForYouProfile()
    await this.setProfile(created, scope)
    return created
  }
}
