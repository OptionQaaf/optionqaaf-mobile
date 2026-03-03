import { customerGraphQL } from "@/lib/shopify/customer/client"
import { isBirthDateValue, type BirthDateValue } from "@/lib/personalization/birthDate"
import { isGenderChoice, type GenderChoice } from "@/lib/personalization/gender"

const CUSTOMER_GENDER_NAMESPACE = "custom"
const CUSTOMER_GENDER_KEY = "gender"
const CUSTOMER_BIRTH_DATE_NAMESPACE = "facts"
const CUSTOMER_BIRTH_DATE_KEY = "birth_date"

const CUSTOMER_PERSONALIZATION_QUERY = /* GraphQL */ `
  query CustomerPersonalizationFacts {
    customer {
      gender: metafield(namespace: "custom", key: "gender") {
        value
      }
      birthDate: metafield(namespace: "facts", key: "birth_date") {
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

const CUSTOMER_METAFIELD_DELETE_MUTATION = /* GraphQL */ `
  mutation CustomerPersonalizationMetafieldDelete($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
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
    gender?: {
      value?: string | null
    } | null
    birthDate?: {
      value?: string | null
    } | null
  } | null
}

type CustomerGenderUpdateResult = {
  metafieldsSet?: {
    userErrors?: { field?: string[] | null; message: string; code?: string | null }[] | null
  } | null
}

type CustomerMetafieldDeleteResult = {
  metafieldsDelete?: {
    userErrors?: { field?: string[] | null; message: string; code?: string | null }[] | null
  } | null
}

export type CustomerPersonalizationFacts = {
  gender: GenderChoice | null
  birthDate: BirthDateValue | null
}

function collectUserErrors(result: CustomerGenderUpdateResult): string[] {
  return (
    result?.metafieldsSet?.userErrors?.map((err) => err?.message).filter((message): message is string => !!message) ??
    []
  )
}

async function setCustomerMetafield(input: {
  customerId: string
  namespace: string
  key: string
  type: string
  value: string
}): Promise<void> {
  const metafields = [
    {
      ownerId: input.customerId,
      namespace: input.namespace,
      key: input.key,
      type: input.type,
      value: input.value,
    },
  ]

  const result = await customerGraphQL<CustomerGenderUpdateResult>(CUSTOMER_GENDER_UPDATE_MUTATION, { metafields })
  const errors = collectUserErrors(result)
  if (errors.length) {
    throw new Error(errors.join("; "))
  }
}

async function deleteCustomerMetafield(input: { customerId: string; namespace: string; key: string }): Promise<void> {
  const metafields = [
    {
      ownerId: input.customerId,
      namespace: input.namespace,
      key: input.key,
    },
  ]

  const result = await customerGraphQL<CustomerMetafieldDeleteResult>(CUSTOMER_METAFIELD_DELETE_MUTATION, {
    metafields,
  })
  const errors =
    result?.metafieldsDelete?.userErrors
      ?.map((err) => err?.message)
      .filter((message): message is string => !!message) ?? []

  if (errors.length) {
    throw new Error(errors.join("; "))
  }
}

export async function fetchCustomerPersonalizationFacts(): Promise<CustomerPersonalizationFacts> {
  const data = await customerGraphQL<CustomerPersonalizationQueryResult>(CUSTOMER_PERSONALIZATION_QUERY)
  const genderValue = data?.customer?.gender?.value
  const birthDateValue = data?.customer?.birthDate?.value

  return {
    gender: isGenderChoice(genderValue) ? genderValue : null,
    birthDate: isBirthDateValue(birthDateValue) ? birthDateValue : null,
  }
}

export async function fetchCustomerGender(): Promise<GenderChoice | null> {
  const facts = await fetchCustomerPersonalizationFacts()
  return facts.gender
}

export async function setCustomerGender(gender: GenderChoice, customerId: string): Promise<void> {
  await setCustomerMetafield({
    customerId,
    namespace: CUSTOMER_GENDER_NAMESPACE,
    key: CUSTOMER_GENDER_KEY,
    type: "single_line_text_field",
    value: gender,
  })
}

export async function fetchCustomerBirthDate(): Promise<BirthDateValue | null> {
  const facts = await fetchCustomerPersonalizationFacts()
  return facts.birthDate
}

export async function setCustomerBirthDate(birthDate: BirthDateValue, customerId: string): Promise<void> {
  await setCustomerMetafield({
    customerId,
    namespace: CUSTOMER_BIRTH_DATE_NAMESPACE,
    key: CUSTOMER_BIRTH_DATE_KEY,
    type: "date",
    value: birthDate,
  })
}

export async function deleteCustomerBirthDate(customerId: string): Promise<void> {
  await deleteCustomerMetafield({
    customerId,
    namespace: CUSTOMER_BIRTH_DATE_NAMESPACE,
    key: CUSTOMER_BIRTH_DATE_KEY,
  })
}
