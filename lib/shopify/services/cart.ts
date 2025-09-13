import { callShopify, shopifyClient, ShopifyError } from "@/lib/shopify/client"
import {
  CartCreateDocument,
  type CartCreateMutation,
  CartLinesAddDocument,
  type CartLinesAddMutation,
  CartLinesRemoveDocument,
  type CartLinesRemoveMutation,
  CartLinesUpdateDocument,
  type CartLinesUpdateMutation,
  CartQueryDocument,
  type CartQueryQuery,
  CartDiscountCodesUpdateDocument,
  type CartDiscountCodesUpdateMutation,
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
