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
      return <Cmp key={section.id} {...props} />

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

    default:
      return <Cmp key={section.id} {...props} onPress={() => navigate((props as any)?.url)} />
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
