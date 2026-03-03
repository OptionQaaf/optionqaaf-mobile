import { GenderChoice } from "@/lib/personalization/gender"
import { CustomerProfile } from "@/lib/shopify/customer/profile"

export type AvatarDetails = {
  initials: string
  color: string
}

export function avatarFromProfile(
  profile: CustomerProfile | null | undefined,
  gender?: GenderChoice | null,
): AvatarDetails {
  const fallback =
    profile?.displayName ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    profile?.email ||
    profile?.id ||
    "Guest"

  return avatarFromNames(profile?.firstName ?? null, profile?.lastName ?? null, fallback, gender)
}

export function avatarFromNames(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback?: string | null,
  gender?: GenderChoice | null,
): AvatarDetails {
  const basis = buildBasis(firstName, lastName, fallback)
  const initials = buildInitials(firstName, lastName, basis)
  const color = colorFromGender(gender ?? undefined)
  return { initials, color }
}

function buildBasis(firstName?: string | null, lastName?: string | null, fallback?: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim()
  const source = name || (fallback ?? "").trim()
  return source || "Guest"
}

function buildInitials(firstName?: string | null, lastName?: string | null, basis?: string): string {
  const tokens = [firstName, lastName]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .map((part) => part.trim())
  const pool = tokens.length ? tokens : (basis || "Guest").trim().split(/\s+/).filter(Boolean)

  if (!pool.length) return "GG"

  const first = pool[0]
  const last = pool.length > 1 ? pool[pool.length - 1] : pool[0]

  const firstChar = (first[0] || "G").toUpperCase()
  const secondChar = (last[0] || firstChar).toUpperCase()

  return `${firstChar}${secondChar}`
}

function colorFromGender(gender: GenderChoice | undefined): string {
  return gender === "male" ? "#1f3d6e" : gender === "female" ? "#be1293" : "#6b7280"
}
