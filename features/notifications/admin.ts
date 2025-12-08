const ADMIN_EMAILS =
  process.env.EXPO_PUBLIC_PUSH_ADMIN_EMAILS
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean) ?? []

export function isPushAdmin(email?: string | null) {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
