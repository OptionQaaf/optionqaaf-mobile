import { clearOnboardingFlag } from "@/lib/storage/flags"
import { Screen } from "@/ui/layout/Screen"
import { Button } from "@/ui/primitives/Button"
import { router } from "expo-router"

export default function ResetOnboarding() {
  return (
    <Screen>
      <Button onPress={handleResetOnboarding} />
    </Screen>
  )
}

async function handleResetOnboarding() {
  await clearOnboardingFlag()
  router.replace("/(onboarding)/locale")
}
