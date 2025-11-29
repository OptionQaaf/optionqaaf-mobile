import markdownSource from "@/markdown/policies/PrivacyPolicy.md"
import { PolicyScreenTemplate } from "@/ui/markdown/PolicyScreenTemplate"

export default function PrivacyPolicyScreen() {
  return <PolicyScreenTemplate title="Privacy Policy" markdownSource={markdownSource} />
}
