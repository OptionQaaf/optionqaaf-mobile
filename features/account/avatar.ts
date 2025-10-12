import { CustomerProfile } from "@/lib/shopify/customer/profile"

const PALETTE = ["#0f172a", "#1e293b", "#312e81", "#0f766e", "#92400e", "#6b21a8", "#be123c", "#1d4ed8"] as const

export type AvatarDetails = {
  initials: string
  color: string
}

export function avatarFromProfile(profile: CustomerProfile | null | undefined): AvatarDetails {
  const fallback =
    profile?.displayName ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    profile?.email ||
    profile?.id ||
    "Guest"

  return avatarFromNames(profile?.firstName ?? null, profile?.lastName ?? null, fallback)
}

export function avatarFromNames(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback?: string | null,
): AvatarDetails {
  const basis = buildBasis(firstName, lastName, fallback)
  const initials = buildInitials(firstName, lastName, basis)
  const color = colorFromSeed(basis)
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

function colorFromSeed(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}
