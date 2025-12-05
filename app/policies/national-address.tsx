import markdownSource from "@/markdown/policies/NationalAddressGuide.md"
import { PolicyScreenTemplate } from "@/ui/markdown/PolicyScreenTemplate"

export default function NationalAddressGuideScreen() {
  return <PolicyScreenTemplate title="كيفية الحصول على العنوان الوطني" markdownSource={markdownSource} />
}
