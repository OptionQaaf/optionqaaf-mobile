export type PopupAudience = "all" | "authenticated" | "guest"

export type PopupIcon =
  | { type: "system"; value: string }
  | { type: "image"; value: string }

export type PopupCTA = {
  label: string
  action: "apply_coupon" | "deeplink"
  value: string
}

export interface PopupPayload {
  schemaVersion: 1
  id: string
  enabled: boolean
  title: string
  body: string
  icon?: PopupIcon
  cta?: PopupCTA
  startAt?: string
  endAt?: string
  minAppVersion?: string
  audience?: PopupAudience
}

export interface StoredPopup extends PopupPayload {
  updatedAt: string
}
