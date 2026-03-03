import { kv } from "@/lib/storage/mmkv"

type BirthDatePromptState = {
  shownOnce: boolean
  triggerAt: number | null
}

const BIRTHDATE_PROMPT_KEY = "personalization-birthdate-prompt-v1"
const PROMPT_MIN_DELAY_MS = 6 * 60 * 60 * 1000
const PROMPT_MAX_DELAY_MS = 72 * 60 * 60 * 1000

function readPromptState(): BirthDatePromptState {
  const raw = kv.get(BIRTHDATE_PROMPT_KEY)
  if (!raw) {
    return { shownOnce: false, triggerAt: null }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BirthDatePromptState>
    return {
      shownOnce: parsed.shownOnce === true,
      triggerAt:
        typeof parsed.triggerAt === "number" && Number.isFinite(parsed.triggerAt) && parsed.triggerAt > 0
          ? parsed.triggerAt
          : null,
    }
  } catch {
    return { shownOnce: false, triggerAt: null }
  }
}

function writePromptState(state: BirthDatePromptState): void {
  kv.set(BIRTHDATE_PROMPT_KEY, JSON.stringify(state))
}

function pickRandomTrigger(nowMs: number): number {
  const span = PROMPT_MAX_DELAY_MS - PROMPT_MIN_DELAY_MS
  return nowMs + PROMPT_MIN_DELAY_MS + Math.floor(Math.random() * span)
}

export function ensureBirthDatePromptTrigger(nowMs: number): BirthDatePromptState {
  const current = readPromptState()
  if (current.shownOnce || current.triggerAt) return current
  const next = { shownOnce: false, triggerAt: pickRandomTrigger(nowMs) }
  writePromptState(next)
  return next
}

export function markBirthDatePromptShown(): void {
  writePromptState({ shownOnce: true, triggerAt: null })
}

export function triggerBirthDatePromptNowForDev(): void {
  writePromptState({ shownOnce: false, triggerAt: Date.now() })
}

export function resetBirthDatePromptStateForDev(): void {
  kv.del(BIRTHDATE_PROMPT_KEY)
}
