export const GENDER_OPTIONS = ["male", "female"] as const
export type GenderChoice = (typeof GENDER_OPTIONS)[number]

export function isGenderChoice(value: unknown): value is GenderChoice {
  return typeof value === "string" && (GENDER_OPTIONS as readonly string[]).includes(value)
}
