import type { AppHomeSection } from "@/lib/shopify/services/home"
import { sectionRegistry } from "./registry"

export type NavigateHandler = (url?: string) => void

const noop: NavigateHandler = () => {}

export function renderMetaobjectSection(section: AppHomeSection, navigate: NavigateHandler) {
  const Cmp = (sectionRegistry as any)[section.kind]
  if (!Cmp) return null
  const props = section as any

  switch (section.kind) {
    case "poster_triptych":
    case "poster_quilt":
      return <Cmp key={section.id} {...props} onPressItem={(url: string | undefined) => navigate(url)} />

    case "brand_cloud":
      return <Cmp key={section.id} {...props} onPressBrand={(url?: string) => navigate(url)} />

    case "duo_poster":
      return (
        <Cmp
          key={section.id}
          {...props}
          onPressLeft={() => navigate(section.left?.url)}
          onPressRight={() => navigate(section.right?.url)}
        />
      )

    case "trio_grid":
      return (
        <Cmp
          key={section.id}
          {...props}
          onPressA={() => navigate(section.a?.url)}
          onPressB={() => navigate(section.b?.url)}
          onPressC={() => navigate(section.c?.url)}
        />
      )

    case "image_carousel":
    case "collection_link_slider":
    case "image_link_slider":
      return <Cmp key={section.id} {...props} onPressItem={(url: string | undefined) => navigate(url)} />

    default:
      const target = section.collectionUrls?.[0] ?? (props as any)?.url
      return <Cmp key={section.id} {...props} onPress={() => navigate(target)} />
  }
}

export function MetaobjectSectionList({
  sections,
  onNavigate,
}: {
  sections?: AppHomeSection[] | null | undefined
  onNavigate?: NavigateHandler
}) {
  const navigate = onNavigate ?? noop
  if (!sections?.length) return null
  return sections.map((section) => renderMetaobjectSection(section, navigate))
}
