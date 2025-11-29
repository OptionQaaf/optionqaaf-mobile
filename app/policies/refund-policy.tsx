import markdownSource from "@/markdown/policies/RefundPolicy.md"
import { PolicyScreenTemplate } from "@/ui/markdown/PolicyScreenTemplate"

export default function RefundPolicyScreen() {
  return <PolicyScreenTemplate title="Refund Policy" markdownSource={markdownSource} />
}
