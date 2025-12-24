import { kv } from "@/lib/storage/mmkv"

const DELETION_REQUEST_KEY = "account-deletion-requested-at"
const DELETION_EMAIL_KEY = "account-deletion-requested-email"
const BUSINESS_DAYS = 3

export function setDeletionRequestTimestamp(date: Date = new Date(), email?: string | null) {
  kv.set(DELETION_REQUEST_KEY, date.toISOString())
  if (email) {
    kv.set(DELETION_EMAIL_KEY, email.trim().toLowerCase())
  } else {
    kv.del(DELETION_EMAIL_KEY)
  }
}

export function getDeletionRequestTimestamp(): Date | null {
  const raw = kv.get(DELETION_REQUEST_KEY)
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    kv.del(DELETION_REQUEST_KEY)
    return null
  }
  return parsed
}

export function isDeletionRequestPending(now: Date = new Date(), email?: string | null): boolean {
  const requestedAt = getDeletionRequestTimestamp()
  if (!requestedAt) return false
  const requestedEmail = kv.get(DELETION_EMAIL_KEY)
  if (requestedEmail && email) {
    if (requestedEmail !== email.trim().toLowerCase()) {
      return false
    }
  } else if (requestedEmail) {
    return false
  }

  const expiresAt = endOfBusinessDay(addBusinessDays(requestedAt, BUSINESS_DAYS))
  if (now <= expiresAt) return true

  kv.del(DELETION_REQUEST_KEY)
  kv.del(DELETION_EMAIL_KEY)
  return false
}

function addBusinessDays(start: Date, days: number): Date {
  const date = new Date(start.getTime())
  let added = 0
  while (added < days) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay()
    if (day !== 0 && day !== 6) {
      added += 1
    }
  }
  return date
}

function endOfBusinessDay(date: Date): Date {
  const end = new Date(date.getTime())
  end.setHours(23, 59, 59, 999)
  return end
}
