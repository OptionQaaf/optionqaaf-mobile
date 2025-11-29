import markdownSource from "@/markdown/policies/ShippingPolicy.md"
import { PolicyScreenTemplate } from "@/ui/markdown/PolicyScreenTemplate"

export default function ShippingPolicyScreen() {
  return <PolicyScreenTemplate title="Shipping Policy" markdownSource={markdownSource} />
}
