import { kv } from "@/lib/storage/storage"

const ONBOARDING_KEY = "onboarding.done"

export async function isOnboardingDone(): Promise<boolean> {
  const value = await kv.get(ONBOARDING_KEY)
  return value === "1"
}

export async function markOnboardingDone(): Promise<void> {
  await kv.set(ONBOARDING_KEY, "1")
}

export async function clearOnboardingFlag(): Promise<void> {
  await kv.set(ONBOARDING_KEY, "0")
}
