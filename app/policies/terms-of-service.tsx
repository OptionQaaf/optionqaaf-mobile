import markdownSource from "@/markdown/policies/TermsOfService.md"
import { PolicyScreenTemplate } from "@/ui/markdown/PolicyScreenTemplate"

export default function TermsOfServiceScreen() {
  return <PolicyScreenTemplate title="Terms of Service" markdownSource={markdownSource} />
}
