import { callShopify, sdk } from "@/lib/shopify/client"
import type { MenuByHandleQuery } from "@/lib/shopify/gql/graphql"
import { currentLocale } from "@/store/prefs"

export type AppRoute =
  | { kind: "collection"; title: string; handle: string }
  | { kind: "product"; title: string; handle: string }
  | { kind: "page"; title: string; handle: string }
  | { kind: "blog"; title: string; handle: string }
  | { kind: "article"; title: string; blogHandle: string; handle: string }
  | { kind: "url"; title: string; url: string }

export type AppMenuItem = { id: string; title: string; route: AppRoute; children: AppMenuItem[] }

export async function getMenuByHandle(handle: string, language?: string) {
  return callShopify<MenuByHandleQuery>(async () => {
    return sdk.MenuByHandle({ handle, language: (language as any) ?? currentLocale().language })
  })
}

function toRoute(node: any): AppRoute {
  const t = node?.resource?.__typename
  if (t === "Collection" && node.resource?.handle)
    return { kind: "collection", title: node.title, handle: node.resource.handle }
  if (t === "Product" && node.resource?.handle)
    return { kind: "product", title: node.title, handle: node.resource.handle }
  if (t === "Page" && node.resource?.handle) return { kind: "page", title: node.title, handle: node.resource.handle }
  if (t === "Blog" && node.resource?.handle) return { kind: "blog", title: node.title, handle: node.resource.handle }
  if (t === "Article" && node.resource?.blog?.handle && node.resource?.handle)
    return { kind: "article", title: node.title, blogHandle: node.resource.blog.handle, handle: node.resource.handle }
  if (node.url) return { kind: "url", title: node.title, url: node.url }
  // Fallback to URL if Shopify can’t resolve resource (e.g., not published)
  return { kind: "url", title: node.title, url: node.url ?? "#" }
}

export function normalizeMenu(data: MenuByHandleQuery | null | undefined): AppMenuItem[] {
  const items = data?.menu?.items ?? []
  const mapNode = (n: any): AppMenuItem => ({
    id: n.id,
    title: n.title,
    route: toRoute(n),
    children: (n.items ?? []).map(mapNode),
  })
  return items.map(mapNode)
}

// Route helpers the UI can use when navigating
export function routeToPath(r: AppRoute): string {
  switch (r.kind) {
    case "collection":
      return `/collections/${r.handle}`
    case "product":
      return `/products/${r.handle}`
    case "page":
      return `/pages/${r.handle}`
    case "blog":
      return `/blog/${r.handle}`
    case "article":
      return `/blog/${r.blogHandle}/${r.handle}`
    case "url":
      return r.url
  }
}
