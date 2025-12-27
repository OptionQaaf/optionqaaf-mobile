import { kv } from "@/lib/storage/storage"

const DELETION_REQUEST_KEY = "account-deletion-requested-at"
const DELETION_EMAIL_KEY = "account-deletion-requested-email"
const BUSINESS_DAYS = 3

export async function setDeletionRequestTimestamp(date: Date = new Date(), email?: string | null) {
  await kv.set(DELETION_REQUEST_KEY, date.toISOString())
  if (email) {
    await kv.set(DELETION_EMAIL_KEY, email.trim().toLowerCase())
  } else {
    await kv.del(DELETION_EMAIL_KEY)
  }
}

export async function getDeletionRequestTimestamp(): Promise<Date | null> {
  const raw = await kv.get(DELETION_REQUEST_KEY)
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    await kv.del(DELETION_REQUEST_KEY)
    return null
  }
  return parsed
}

export async function isDeletionRequestPending(now: Date = new Date(), email?: string | null): Promise<boolean> {
  const requestedAt = await getDeletionRequestTimestamp()
  if (!requestedAt) return false
  const requestedEmail = await kv.get(DELETION_EMAIL_KEY)
  if (requestedEmail && email) {
    if (requestedEmail !== email.trim().toLowerCase()) {
      return false
    }
  } else if (requestedEmail) {
    return false
  }

  const expiresAt = endOfBusinessDay(addBusinessDays(requestedAt, BUSINESS_DAYS))
  if (now <= expiresAt) return true

  await kv.del(DELETION_REQUEST_KEY)
  await kv.del(DELETION_EMAIL_KEY)
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
