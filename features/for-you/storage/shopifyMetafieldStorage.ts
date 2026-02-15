import { createEmptyForYouProfile, normalizeForYouProfile, pruneForYouProfile, type ForYouProfile } from "@/features/for-you/profile"
import { customerGraphQL } from "@/lib/shopify/customer/client"

const FOR_YOU_NAMESPACE = "custom"
const FOR_YOU_KEY = "for_you_profile"
const FOR_YOU_METAFIELD_TYPE = "json"

const CUSTOMER_FOR_YOU_METAFIELD_QUERY = /* GraphQL */ `
  query CustomerForYouMetafield($namespace: String!, $key: String!) {
    customer {
      id
      metafield(namespace: $namespace, key: $key) {
        value
      }
    }
  }
`

const CUSTOMER_FOR_YOU_METAFIELD_SET_MUTATION = /* GraphQL */ `
  mutation CustomerForYouMetafieldSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        namespace
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

type CustomerMetafieldQueryResult = {
  customer?: {
    id?: string | null
    metafield?: {
      value?: string | null
    } | null
  } | null
}

type MetafieldsSetResult = {
  metafieldsSet?: {
    metafields?: Array<{ namespace?: string | null; key?: string | null; value?: string | null } | null> | null
    userErrors?: Array<{ field?: string[] | null; message?: string | null; code?: string | null } | null> | null
  } | null
}

export class ShopifyMetafieldForYouProfileStorage {
  async getDebugMetafieldState(): Promise<{
    customerId: string | null
    status: "present" | "missing" | "read_error"
    rawValue: string | null
    parsedProfile: ForYouProfile | null
    error: string | null
  }> {
    try {
      const data = await customerGraphQL<CustomerMetafieldQueryResult>(CUSTOMER_FOR_YOU_METAFIELD_QUERY, {
        namespace: FOR_YOU_NAMESPACE,
        key: FOR_YOU_KEY,
      })
      const customerId = data?.customer?.id ?? null
      const rawValue = data?.customer?.metafield?.value ?? null
      if (!customerId) {
        return {
          customerId: null,
          status: "missing",
          rawValue: null,
          parsedProfile: null,
          error: null,
        }
      }
      if (!rawValue) {
        return {
          customerId,
          status: "missing",
          rawValue: null,
          parsedProfile: null,
          error: null,
        }
      }
      try {
        return {
          customerId,
          status: "present",
          rawValue,
          parsedProfile: normalizeForYouProfile(JSON.parse(rawValue)),
          error: null,
        }
      } catch (parseError: any) {
        return {
          customerId,
          status: "read_error",
          rawValue,
          parsedProfile: null,
          error: parseError?.message ?? "Failed to parse metafield JSON",
        }
      }
    } catch (error: any) {
      return {
        customerId: null,
        status: "read_error",
        rawValue: null,
        parsedProfile: null,
        error: error?.message ?? "Failed to read customer metafield",
      }
    }
  }

  async getCustomerId(): Promise<string | null> {
    const data = await customerGraphQL<CustomerMetafieldQueryResult>(CUSTOMER_FOR_YOU_METAFIELD_QUERY, {
      namespace: FOR_YOU_NAMESPACE,
      key: FOR_YOU_KEY,
    })
    return data?.customer?.id ?? null
  }

  async getProfile(): Promise<{ customerId: string; profile: ForYouProfile | null } | null> {
    const data = await customerGraphQL<CustomerMetafieldQueryResult>(CUSTOMER_FOR_YOU_METAFIELD_QUERY, {
      namespace: FOR_YOU_NAMESPACE,
      key: FOR_YOU_KEY,
    })

    const customerId = data?.customer?.id
    if (!customerId) return null

    const value = data?.customer?.metafield?.value
    if (!value) return { customerId, profile: null }

    try {
      const parsed = JSON.parse(value)
      return { customerId, profile: normalizeForYouProfile(parsed) }
    } catch {
      return { customerId, profile: null }
    }
  }

  async setProfile(profile: ForYouProfile, customerId?: string | null): Promise<string | null> {
    const targetCustomerId = customerId ?? (await this.getCustomerId())
    if (!targetCustomerId) return null

    const normalized = pruneForYouProfile(normalizeForYouProfile(profile))
    const data = await customerGraphQL<MetafieldsSetResult>(CUSTOMER_FOR_YOU_METAFIELD_SET_MUTATION, {
      metafields: [
        {
          ownerId: targetCustomerId,
          namespace: FOR_YOU_NAMESPACE,
          key: FOR_YOU_KEY,
          type: FOR_YOU_METAFIELD_TYPE,
          value: JSON.stringify(normalized),
        },
      ],
    })

    const errors = (data?.metafieldsSet?.userErrors ?? [])
      .map((e) => ({
        message: e?.message ?? "Unknown metafieldsSet error",
        code: e?.code ?? null,
        field: e?.field ?? null,
      }))
      .filter((e) => Boolean(e.message))
    if (errors.length) {
      const payload = JSON.stringify(errors)
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("[for-you] metafieldsSet userErrors", payload)
      }
      throw new Error(`metafieldsSet userErrors: ${payload}`)
    }

    const persisted = (data?.metafieldsSet?.metafields ?? []).filter(
      (entry) => entry?.namespace === FOR_YOU_NAMESPACE && entry?.key === FOR_YOU_KEY,
    )
    if (!persisted.length) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("[for-you] metafieldsSet returned no persisted metafield", data?.metafieldsSet ?? null)
      }
      throw new Error("metafieldsSet did not return persisted metafield")
    }

    return targetCustomerId
  }

  async resetProfile(customerId?: string | null): Promise<string | null> {
    const targetCustomerId = customerId ?? (await this.getCustomerId())
    if (!targetCustomerId) return null
    const empty = createEmptyForYouProfile()
    return this.setProfile(empty, targetCustomerId)
  }
}
