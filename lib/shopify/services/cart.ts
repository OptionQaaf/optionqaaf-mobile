import { callShopify, shopifyClient, ShopifyError } from "@/lib/shopify/client"
import {
  CartBuyerIdentityUpdateDocument,
  type CartBuyerIdentityUpdateMutation,
  type CartBuyerIdentityInput,
  CartCreateDocument,
  type CartCreateMutation,
  CartDiscountCodesUpdateDocument,
  type CartDiscountCodesUpdateMutation,
  CartLinesAddDocument,
  type CartLinesAddMutation,
  CartLinesRemoveDocument,
  type CartLinesRemoveMutation,
  CartLinesUpdateDocument,
  type CartLinesUpdateMutation,
  CartQueryDocument,
  type CartQueryQuery,
} from "@/lib/shopify/gql/graphql"

function assertNoUserErrors<T extends { userErrors?: { message: string }[] }>(payload: T) {
  const errs = (payload.userErrors || []).map((e) => e.message)
  if (errs.length) throw new ShopifyError(errs.join("; "))
}

export async function createCart(
  args: { lines?: { merchandiseId: string; quantity: number }[]; buyerIdentity?: any },
  locale?: { country?: string; language?: string },
) {
  return callShopify<CartCreateMutation>(async () => {
    const res = await shopifyClient.request(CartCreateDocument, {
      lines: args.lines as any,
      buyerIdentity: args.buyerIdentity,
      country: locale?.country as any,
      language: locale?.language as any,
    })
    assertNoUserErrors(res.cartCreate!)
    return res
  })
}

export async function getCart(id: string, locale?: { country?: string; language?: string }) {
  return callShopify<CartQueryQuery>(() =>
    shopifyClient.request(CartQueryDocument, {
      id,
      country: locale?.country as any,
      language: locale?.language as any,
    }),
  )
}

export async function addLines(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[],
  locale?: { country?: string; language?: string },
) {
  return callShopify<CartLinesAddMutation>(async () => {
    const res = await shopifyClient.request(CartLinesAddDocument, {
      cartId,
      lines: lines as any,
      country: locale?.country as any,
      language: locale?.language as any,
    })
    assertNoUserErrors(res.cartLinesAdd!)
    return res
  })
}

export async function updateLines(
  cartId: string,
  lines: { id: string; quantity?: number }[],
  locale?: { country?: string; language?: string },
) {
  return callShopify<CartLinesUpdateMutation>(async () => {
    const res = await shopifyClient.request(CartLinesUpdateDocument, {
      cartId,
      lines: lines as any,
      country: locale?.country as any,
      language: locale?.language as any,
    })
    assertNoUserErrors(res.cartLinesUpdate!)
    return res
  })
}

export async function removeLines(cartId: string, lineIds: string[], locale?: { country?: string; language?: string }) {
  return callShopify<CartLinesRemoveMutation>(async () => {
    const res = await shopifyClient.request(CartLinesRemoveDocument, {
      cartId,
      lineIds,
      country: locale?.country as any,
      language: locale?.language as any,
    })
    assertNoUserErrors(res.cartLinesRemove!)
    return res
  })
}

export async function updateDiscountCodes(
  cartId: string,
  codes: string[] | undefined,
  locale?: { country?: string; language?: string },
) {
  return callShopify<CartDiscountCodesUpdateMutation>(async () => {
    const res = await shopifyClient.request(CartDiscountCodesUpdateDocument, {
      cartId,
      discountCodes: codes as any,
      country: locale?.country as any,
      language: locale?.language as any,
    })
    assertNoUserErrors(res.cartDiscountCodesUpdate!)
    return res
  })
}

export async function updateBuyerIdentity(
  cartId: string,
  buyerIdentity: CartBuyerIdentityInput,
  locale?: { country?: string; language?: string },
) {
  return callShopify<CartBuyerIdentityUpdateMutation>(async () => {
    const res = await shopifyClient.request(CartBuyerIdentityUpdateDocument, {
      cartId,
      buyerIdentity,
      country: locale?.country as any,
      language: locale?.language as any,
    })
    assertNoUserErrors(res.cartBuyerIdentityUpdate!)
    return res
  })
}

type CartAttributesUpdatePayload = {
  cartAttributesUpdate?: { cart?: { id: string; attributes?: { key?: string | null; value?: string | null }[] }; userErrors?: { message?: string | null }[] }
}

export async function updateCartAttributes(
  cartId: string,
  attributes: { key: string; value: string }[],
  locale?: { country?: string; language?: string },
) {
  const mutation = /* GraphQL */ `
    mutation CartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!, $country: CountryCode, $language: LanguageCode) {
      cartAttributesUpdate(cartId: $cartId, attributes: $attributes, country: $country, language: $language) {
        cart { id attributes { key value } }
        userErrors { message }
      }
    }
  `

  return callShopify<CartAttributesUpdatePayload>(async () => {
    const res = await shopifyClient.request(mutation, {
      cartId,
      attributes,
      country: locale?.country,
      language: locale?.language,
    })
    const errors = res.cartAttributesUpdate?.userErrors?.map((e) => e?.message).filter(Boolean)
    if (errors?.length) throw new ShopifyError(errors.join("; "))
    return res
  })
}

type CartDeliveryAddressesReplacePayload = {
  cartDeliveryAddressesReplace?: { cart?: { id: string }; userErrors?: { message?: string | null }[] }
}

export async function replaceCartDeliveryAddresses(
  cartId: string,
  addresses: { address: { copyFromCustomerAddressId: string }; selected?: boolean; oneTimeUse?: boolean }[],
  locale?: { country?: string; language?: string },
) {
  const mutation = /* GraphQL */ `
    mutation CartDeliveryAddressesReplace(
      $cartId: ID!
      $addresses: [CartSelectableAddressInput!]!
      $country: CountryCode
      $language: LanguageCode
    ) {
      cartDeliveryAddressesReplace(cartId: $cartId, addresses: $addresses, country: $country, language: $language) {
        cart { id }
        userErrors { message }
      }
    }
  `

  return callShopify<CartDeliveryAddressesReplacePayload>(async () => {
    const res = await shopifyClient.request(mutation, {
      cartId,
      addresses,
      country: locale?.country,
      language: locale?.language,
    })
    const errors = res.cartDeliveryAddressesReplace?.userErrors?.map((e) => e?.message).filter(Boolean)
    if (errors?.length) throw new ShopifyError(errors.join("; "))
    return res
  })
}
