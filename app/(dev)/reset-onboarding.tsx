import { clearOnboardingFlag } from "@/lib/storage/flags"
import { kv } from "@/lib/storage/mmkv"
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
  kv.del("personalization-settings")
  kv.del("personalization-events-v1")
  await clearOnboardingFlag()
  router.replace("/(onboarding)/locale")
}
