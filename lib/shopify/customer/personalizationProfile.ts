import {
  mergePersonalizationProfiles,
  normalizePersonalizationProfile,
  type PersonalizationProfileV1,
} from "@/lib/personalization/events"
import { customerGraphQL } from "@/lib/shopify/customer/client"

const CUSTOMER_PERSONALIZATION_NAMESPACE = "custom"
const CUSTOMER_PERSONALIZATION_KEY = "personalization_profile_v1"

const CUSTOMER_PERSONALIZATION_QUERY = /* GraphQL */ `
  query CustomerPersonalizationProfile {
    customer {
      metafield(namespace: "custom", key: "personalization_profile_v1") {
        value
      }
    }
  }
`

const CUSTOMER_PERSONALIZATION_UPDATE_MUTATION = /* GraphQL */ `
  mutation CustomerPersonalizationProfileUpdate($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        field
        message
        code
      }
    }
  }
`

type CustomerPersonalizationQueryResult = {
  customer?: {
    metafield?: {
      value?: string | null
    } | null
  } | null
}

type CustomerPersonalizationUpdateResult = {
  metafieldsSet?: {
    userErrors?: { field?: string[] | null; message: string; code?: string | null }[] | null
  } | null
}

function parseProfileValue(value: string | null | undefined): PersonalizationProfileV1 | null {
  if (!value || typeof value !== "string") return null
  try {
    const parsed = JSON.parse(value)
    return normalizePersonalizationProfile(parsed)
  } catch {
    return null
  }
}

async function runSetProfileMutation(
  profile: PersonalizationProfileV1,
  customerId: string,
  type: "json" | "single_line_text_field",
): Promise<void> {
  const metafields = [
    {
      ownerId: customerId,
      namespace: CUSTOMER_PERSONALIZATION_NAMESPACE,
      key: CUSTOMER_PERSONALIZATION_KEY,
      type,
      value: JSON.stringify(profile),
    },
  ]

  const result = await customerGraphQL<CustomerPersonalizationUpdateResult>(CUSTOMER_PERSONALIZATION_UPDATE_MUTATION, {
    metafields,
  })

  const errors =
    result?.metafieldsSet?.userErrors
      ?.map((error) => error?.message)
      .filter((message): message is string => !!message) ?? []

  if (errors.length) {
    throw new Error(errors.join("; "))
  }
}

export async function fetchCustomerPersonalizationProfile(): Promise<PersonalizationProfileV1 | null> {
  const data = await customerGraphQL<CustomerPersonalizationQueryResult>(CUSTOMER_PERSONALIZATION_QUERY)
  return parseProfileValue(data?.customer?.metafield?.value)
}

export async function setCustomerPersonalizationProfile(
  profile: PersonalizationProfileV1,
  customerId: string,
): Promise<void> {
  const normalized = normalizePersonalizationProfile(profile)

  try {
    await runSetProfileMutation(normalized, customerId, "json")
    return
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[personalization] JSON metafield write failed, retrying as text", error)
    }
  }

  await runSetProfileMutation(normalized, customerId, "single_line_text_field")
}

export function mergeLocalAndRemoteProfiles(
  local: PersonalizationProfileV1,
  remote: PersonalizationProfileV1 | null,
): PersonalizationProfileV1 {
  return mergePersonalizationProfiles(local, remote)
}
