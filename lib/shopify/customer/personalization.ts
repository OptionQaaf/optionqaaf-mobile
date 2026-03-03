import { customerGraphQL } from "@/lib/shopify/customer/client"
import { isGenderChoice, type GenderChoice } from "@/lib/personalization/gender"

const CUSTOMER_GENDER_NAMESPACE = "custom"
const CUSTOMER_GENDER_KEY = "gender"

const CUSTOMER_GENDER_QUERY = /* GraphQL */ `
  query CustomerGender {
    customer {
      metafield(namespace: "custom", key: "gender") {
        value
      }
    }
  }
`

const CUSTOMER_GENDER_UPDATE_MUTATION = /* GraphQL */ `
  mutation CustomerGenderUpdate($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        field
        message
        code
      }
    }
  }
`

type CustomerGenderQueryResult = {
  customer?: {
    metafield?: {
      value?: string | null
    } | null
  } | null
}

type CustomerGenderUpdateResult = {
  metafieldsSet?: {
    userErrors?: { field?: string[] | null; message: string; code?: string | null }[] | null
  } | null
}

export async function fetchCustomerGender(): Promise<GenderChoice | null> {
  const data = await customerGraphQL<CustomerGenderQueryResult>(CUSTOMER_GENDER_QUERY)
  const value = data?.customer?.metafield?.value
  return isGenderChoice(value) ? value : null
}

export async function setCustomerGender(gender: GenderChoice, customerId: string): Promise<void> {
  const metafields = [
    {
      ownerId: customerId,
      namespace: CUSTOMER_GENDER_NAMESPACE,
      key: CUSTOMER_GENDER_KEY,
      type: "single_line_text_field",
      value: gender,
    },
  ]

  const result = await customerGraphQL<CustomerGenderUpdateResult>(CUSTOMER_GENDER_UPDATE_MUTATION, { metafields })
  const errors =
    result?.metafieldsSet?.userErrors?.map((err) => err?.message).filter((message): message is string => !!message) ??
    []

  if (errors.length) {
    throw new Error(errors.join("; "))
  }
}
