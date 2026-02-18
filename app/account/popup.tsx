import { AccountSignInFallback } from "@/features/account/SignInFallback"
import { useCustomerProfile } from "@/features/account/api"
import { AuthGate } from "@/features/auth/AuthGate"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { isPushAdmin } from "@/features/notifications/admin"
import { clearAdminCurrentPopup, fetchAdminCurrentPopup, setAdminCurrentPopup } from "@/features/popup/adminApi"
import { PopupAudience, PopupCTA, PopupPayload, StoredPopup } from "@/types/popup"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Screen } from "@/ui/layout/Screen"
import { InAppPopupModal } from "@/ui/popup/InAppPopupModal"
import { SYSTEM_ICON_MAP, type SystemIconName } from "@/ui/popup/systemIcons"
import { Button } from "@/ui/primitives/Button"
import { Input } from "@/ui/primitives/Input"
import { Card } from "@/ui/surfaces/Card"
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker"
import { useRouter } from "expo-router"
import { type LucideIcon } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const WORKER_URL = (process.env.EXPO_PUBLIC_PUSH_WORKER_URL || "").replace(/\/+$/, "")
const ADMIN_SECRET = process.env.EXPO_PUBLIC_PUSH_ADMIN_SECRET
const missingConfig = !WORKER_URL || !ADMIN_SECRET
const ICON_KEYS = Object.keys(SYSTEM_ICON_MAP) as SystemIconName[]

function createFreshPopupId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `popup-${globalThis.crypto.randomUUID()}`
  }
  return `popup-${Math.random().toString(36).slice(2)}`
}

function createFreshFormState(): FormState {
  const start = new Date()
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return {
    enabled: true,
    popupId: createFreshPopupId(),
    title: "",
    body: "",
    iconValue: "" as IconKey | "",
    ctaLabel: "",
    ctaAction: "apply_coupon",
    ctaEnabled: false,
    ctaValue: "",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    audience: "all",
  }
}

function buildPreviewPopup(state: FormState): PopupPayload | null {
  const trimmedId = state.popupId.trim()
  const trimmedTitle = state.title.trim()
  const trimmedBody = state.body.trim()
  if (!trimmedId || !trimmedTitle || !trimmedBody) return null

  const iconKey = state.iconValue && ICON_KEYS.includes(state.iconValue as IconKey) ? (state.iconValue as IconKey) : ""
  const icon = iconKey ? { type: "system" as const, value: iconKey } : undefined

  const hasCta = state.ctaEnabled && state.ctaLabel.trim() && state.ctaValue.trim()
  const cta: PopupCTA | undefined = hasCta
    ? {
        label: state.ctaLabel.trim(),
        action: state.ctaAction,
        value: state.ctaValue.trim(),
      }
    : undefined

  return {
    schemaVersion: 1,
    id: trimmedId,
    enabled: state.enabled,
    title: trimmedTitle,
    body: trimmedBody,
    icon: icon && icon.value ? icon : undefined,
    cta,
    startAt: state.startAt.trim() || undefined,
    endAt: state.endAt.trim() || undefined,
    audience: state.audience,
  }
}

type IconKey = SystemIconName
type IconItem = { id: IconKey; label: string; Icon: LucideIcon }
const ICON_ITEMS: IconItem[] = ICON_KEYS.map((key) => ({
  id: key,
  label: key,
  Icon: SYSTEM_ICON_MAP[key],
}))

type FormState = {
  enabled: boolean
  popupId: string
  title: string
  body: string
  iconValue: IconKey | ""
  ctaLabel: string
  ctaAction: PopupCTA["action"]
  ctaEnabled: boolean
  ctaValue: string
  startAt: string
  endAt: string
  audience: PopupAudience
}

const ACTIONS: PopupCTA["action"][] = ["apply_coupon", "deeplink"]
const AUDIENCE_OPTIONS: PopupAudience[] = ["all", "authenticated", "guest"]

export default function PopupAdminScreen() {
  const router = useRouter()

  return (
    <AuthGate
      requireAuth
      fallback={<AccountSignInFallback onSuccess={() => router.replace("/account/popup" as const)} />}
    >
      <Screen bleedBottom>
        <PopupAdminContent />
      </Screen>
    </AuthGate>
  )
}

type IconPickerProps = {
  label: string
  value: IconKey | ""
  onChange: (value: IconKey | "") => void
  disabled?: boolean
}

function IconPicker({ label, value, onChange, disabled = false }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])
  const selected = ICON_ITEMS.find((item) => item.id === value)
  const handleOpen = () => {
    if (disabled) return
    setOpen(true)
  }

  return (
    <>
      <PressableOverlay
        onPress={handleOpen}
        className={`w-full rounded-xl border border-border bg-surface p-2 ${disabled ? "opacity-60" : ""}`}
        disabled={disabled}
        accessibilityLabel={`Select ${label}`}
      >
        <View className="flex-row items-center gap-3">
          {selected ? (
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#e2e8f0]">
              <selected.Icon size={16} color="#475569" />
            </View>
          ) : (
            <View className="h-8 w-8 bg-[#e2e8f0] rounded-full" />
          )}
          <Text className={selected ? "text-[#0f172a]" : "text-[#94a3b8]"}>{selected ? selected.label : label}</Text>
        </View>
      </PressableOverlay>
      <Modal visible={open} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)" }} onPress={() => setOpen(false)} />
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            top: "30%",
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: 16,
            maxHeight: "50%",
          }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[#0f172a] font-geist-semibold text-[15px]">Choose an icon</Text>
            <Pressable onPress={() => setOpen(false)} className="px-2 py-1">
              <Text className="text-[#0f172a] font-geist-semibold">Done</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              <Pressable
                onPress={() => {
                  onChange("")
                  setOpen(false)
                }}
                className="flex-row items-center gap-3 rounded-xl border border-border px-3 py-2"
                style={{ backgroundColor: value === "" ? "#f1f5f9" : "#ffffff" }}
              >
                <View className="h-6 w-6 items-center justify-center rounded-lg bg-[#e2e8f0]">
                  <View className="h-4 w-4" />
                </View>
                <Text className="text-[#0f172a] font-geist-semibold">None</Text>
              </Pressable>
              {ICON_ITEMS.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    onChange(item.id)
                    setOpen(false)
                  }}
                  className="flex-row items-center gap-3 rounded-xl border border-border px-3 py-2"
                  style={{ backgroundColor: value === item.id ? "#f1f5f9" : "#ffffff" }}
                >
                  <item.Icon size={24} color="#0f172a" />
                  <Text className="text-[#0f172a] font-geist-semibold">{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}

function parseDate(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatPopupDate(value?: string) {
  if (!value) return "Not set"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function formatAudienceLabel(value?: PopupAudience) {
  if (value === "authenticated") return "Logged-in"
  if (value === "guest") return "Guests"
  return "Everyone"
}

type DatePickerFieldProps = {
  label: string
  value: string
  onChange?: (value: string) => void
  minimumDate?: Date
  disabled?: boolean
}

function DatePickerField({ label, value, onChange, minimumDate, disabled = false }: DatePickerFieldProps) {
  const [pickerDate, setPickerDate] = useState(() => parseDate(value) ?? new Date())

  useEffect(() => {
    setPickerDate(parseDate(value) ?? new Date())
  }, [value])

  const handleChange = useCallback(
    (_event: DateTimePickerEvent, next?: Date) => {
      const resolved = next ?? pickerDate
      if (!resolved) return
      setPickerDate(resolved)
      if (!disabled && onChange) {
        onChange(resolved.toISOString())
      }
    },
    [disabled, onChange, pickerDate],
  )

  const displayMode = Platform.OS === "ios" ? "inline" : "calendar"

  return (
    <View className="gap-2">
      <Text className="text-[#475569] text-[13px]">{label}</Text>
      <DateTimePicker
        value={pickerDate}
        onChange={handleChange}
        display={displayMode}
        mode="date"
        minimumDate={minimumDate}
        themeVariant="light"
      />
    </View>
  )
}

type PopupViewModeProps = {
  popup: StoredPopup
  onEdit?: () => void
}

function PopupViewMode({ popup, onEdit }: PopupViewModeProps) {
  const iconKey =
    popup.icon?.type === "system" && ICON_KEYS.includes(popup.icon.value as IconKey)
      ? (popup.icon.value as IconKey)
      : undefined
  const iconItem = iconKey ? ICON_ITEMS.find((item) => item.id === iconKey) : undefined
  const ctaLabel = popup.cta?.label ?? "No CTA configured"
  const ctaActionLabel = popup.cta?.action === "apply_coupon" ? "Apply coupon" : "Deeplink"

  return (
    <Pressable onPress={onEdit} className="gap-4" style={onEdit ? { paddingVertical: 2 } : undefined}>
      <View className="gap-1">
        <Text className="text-[#475569] text-[13px]">Title</Text>
        <Text className="text-[#0f172a] font-geist-semibold text-[16px]">{popup.title}</Text>
      </View>

      <View className="gap-1">
        <Text className="text-[#475569] text-[13px]">Body</Text>
        <Text className="text-[#0f172a] text-[14px] leading-relaxed">{popup.body}</Text>
      </View>

      <View className="gap-1">
        <Text className="text-[#475569] text-[13px]">Icon</Text>
        {iconItem ? (
          <View className="flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-[#e2e8f0]">
              <iconItem.Icon size={16} color="#475569" />
            </View>
            <Text className="text-[#0f172a] text-[14px]">{iconItem.label}</Text>
          </View>
        ) : (
          <Text className="text-[#94a3b8] text-[14px]">{popup.icon?.value ?? "None"}</Text>
        )}
      </View>

      <View className="gap-1">
        <Text className="text-[#475569] text-[13px]">CTA</Text>
        {popup.cta ? (
          <View className="rounded-xl border border-border bg-[#eef2ff] p-3">
            <Text className="font-geist-semibold text-[#0f172a] text-[14px]">{ctaLabel}</Text>
            <Text className="text-[#475569] text-[12px]">{ctaActionLabel}</Text>
            <Text className="text-[#475569] text-[12px]">{popup.cta.value}</Text>
          </View>
        ) : (
          <Text className="text-[#94a3b8] text-[14px]">{ctaLabel}</Text>
        )}
      </View>

      <View className="gap-1">
        <Text className="text-[#475569] text-[13px]">Scheduling</Text>
        <Text className="text-[#0f172a] text-[14px]">Start: {formatPopupDate(popup.startAt)}</Text>
        <Text className="text-[#0f172a] text-[14px]">End: {formatPopupDate(popup.endAt)}</Text>
      </View>

      <View className="gap-1">
        <Text className="text-[#475569] text-[13px]">Audience</Text>
        <Text className="text-[#0f172a] text-[14px]">{formatAudienceLabel(popup.audience)}</Text>
      </View>
    </Pressable>
  )
}

function PopupAdminContent() {
  const { isAuthenticated } = useShopifyAuth()
  const { data: profile } = useCustomerProfile({ enabled: isAuthenticated })
  const isAdmin = useMemo(() => isPushAdmin(profile?.email), [profile?.email])
  const { show } = useToast()
  const insets = useSafeAreaInsets()

  const [form, setForm] = useState<FormState>(() => createFreshFormState())
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [currentPopup, setCurrentPopup] = useState<StoredPopup | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [isEditing, setIsEditing] = useState(true)

  const syncFormWithPopup = useCallback((popup: StoredPopup | null) => {
    if (!popup) {
      setForm(createFreshFormState())
      return
    }
    const iconValue =
      popup.icon?.type === "system" && ICON_KEYS.includes(popup.icon.value as IconKey)
        ? (popup.icon.value as IconKey)
        : ""
    setForm({
      enabled: popup.enabled !== false,
      popupId: popup.id,
      title: popup.title,
      body: popup.body,
      iconValue,
      ctaLabel: popup.cta?.label ?? "",
      ctaAction: popup.cta?.action ?? "apply_coupon",
      ctaValue: popup.cta?.value ?? "",
      startAt: popup.startAt ?? "",
      endAt: popup.endAt ?? "",
      ctaEnabled: Boolean(popup.cta?.label && popup.cta?.value),
      audience: popup.audience ?? "all",
    })
  }, [])

  const previewPopup = useMemo(() => buildPreviewPopup(form), [form])

  const campaignStatus = useMemo(() => {
    if (currentPopup) {
      return `Live popup • updated ${new Date(currentPopup.updatedAt ?? Date.now()).toLocaleString()}`
    }
    return "No popup published"
  }, [currentPopup])

  const isViewMode = Boolean(currentPopup && !isEditing)

  useEffect(() => {
    if (!isAdmin) {
      setCurrentPopup(null)
      setForm(createFreshFormState())
      return
    }

    let active = true
    const load = async () => {
      if (missingConfig) return
      setIsLoading(true)
      try {
        const popup = await fetchAdminCurrentPopup()
        if (!active) return
        if (!popup) {
          setCurrentPopup(null)
          syncFormWithPopup(null)
          setIsEditing(true)
          return
        }
        setCurrentPopup(popup)
        syncFormWithPopup(popup)
        setIsEditing(false)
      } catch (err: any) {
        console.error("Popup admin load error:", err)
        if (active) show({ title: err?.message || "Unable to load popup", type: "danger" })
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [isAdmin, show, syncFormWithPopup])

  const endDateErrorShown = useRef(false)

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      if (isViewMode) return
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [isViewMode],
  )

  const handleStartChange = useCallback(
    (value: string) => {
      updateField("startAt", value)
      const parsed = parseDate(value)
      if (parsed) {
        const endDate = new Date(parsed.getTime() + 7 * 24 * 60 * 60 * 1000)
        updateField("endAt", endDate.toISOString())
      }
    },
    [updateField],
  )

  useEffect(() => {
    const start = parseDate(form.startAt)
    const end = parseDate(form.endAt)
    const isInvalid = !!start && !!end && end.getTime() <= start.getTime()
    if (isInvalid && !endDateErrorShown.current) {
      show({ title: "End date must be after start", type: "danger" })
      endDateErrorShown.current = true
      return
    }
    if (!isInvalid && endDateErrorShown.current) {
      endDateErrorShown.current = false
    }
  }, [form.startAt, form.endAt, show])

  const handleActionSelect = useCallback(
    (action: PopupCTA["action"]) => {
      updateField("ctaEnabled", true)
      updateField("ctaAction", action)
    },
    [updateField],
  )

  const handleAudienceSelect = useCallback(
    (next: PopupAudience) => {
      updateField("audience", next)
    },
    [updateField],
  )

  const validatePayload = useCallback(() => {
    const trimmedId = form.popupId.trim()
    const trimmedTitle = form.title.trim()
    const trimmedBody = form.body.trim()
    if (!trimmedId) return "Popup ID is required"
    if (!trimmedTitle) return "Title is required"
    if (!trimmedBody) return "Body copy is required"
    if (form.ctaEnabled) {
      if (!form.ctaLabel.trim() || !form.ctaValue.trim()) {
        return "CTA label and value are both required"
      }
    }
    if (form.startAt.trim()) {
      const startDate = parseDate(form.startAt.trim())
      if (!startDate) {
        return "Start date must be valid"
      }
      const today = startOfDay(new Date())
      if (startOfDay(startDate).getTime() < today.getTime()) {
        return "Start date cannot be in the past"
      }
    }
    if (form.startAt.trim() && form.endAt.trim()) {
      const start = Date.parse(form.startAt.trim())
      const end = Date.parse(form.endAt.trim())
      if (Number.isNaN(start) || Number.isNaN(end)) {
        return "Start and end must be valid ISO timestamps"
      }
      if (start >= end) {
        return "Start must occur before end"
      }
    }
    return null
  }, [form])

  const handleSave = useCallback(async () => {
    const validationError = validatePayload()
    if (validationError) {
      show({ title: validationError, type: "info" })
      return
    }
    if (!previewPopup) {
      show({ title: "Enter popup details above", type: "info" })
      return
    }
    setIsSaving(true)
    try {
      await setAdminCurrentPopup(previewPopup)
      show({ title: "Popup published", type: "success" })
      setCurrentPopup({ ...previewPopup, updatedAt: new Date().toISOString() })
    } catch (err: any) {
      console.error("Popup admin save error:", err)
      show({ title: err?.message || "Unable to save popup", type: "danger" })
    } finally {
      setIsSaving(false)
    }
  }, [previewPopup, show, validatePayload])

  const handleClear = useCallback(() => {
    if (missingConfig) {
      show({ title: "Push worker config missing", type: "danger" })
      return
    }
    Alert.alert(
      "Clear popup",
      "Clearing removes the current popup for all users. This cannot be undone from the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setIsClearing(true)
            try {
              await clearAdminCurrentPopup()
              show({ title: "Popup cleared", type: "success" })
              setCurrentPopup(null)
              setForm(createFreshFormState())
            } catch (err: any) {
              console.error("Popup admin clear error:", err)
              show({ title: err?.message || "Unable to clear popup", type: "danger" })
            } finally {
              setIsClearing(false)
            }
          },
        },
      ],
    )
  }, [show])

  const handlePreview = useCallback(() => {
    if (!previewPopup) {
      show({ title: "Valid popup data required for preview", type: "info" })
      return
    }
    setPreviewVisible(true)
  }, [previewPopup, show])

  if (!isAdmin) {
    return (
      <View className="flex-1 justify-center px-5">
        <Card padding="lg" className="gap-3">
          <Text className="text-[#0f172a] font-geist-semibold text-[16px]">Admin access required</Text>
          <Text className="text-[#475569] text-[14px]">
            This tool is reserved for administrators. Contact the team if you believe you should have access.
          </Text>
        </Card>
      </View>
    )
  }

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          contentContainerClassName="gap-4"
          className="px-5 pt-6 bg-[#f8fafc]"
          keyboardShouldPersistTaps="handled"
        >
          <Card padding="lg" className="gap-2">
            <View className="gap-2 justify-between">
              <Text className="text-[#0f172a] font-geist-semibold text-[17px]">Popup manager</Text>
              <Text className="text-[#0f172a] text-[12px]">{campaignStatus}</Text>
            </View>
            <Text className="text-[#475569] text-[13px]">
              Publish in-app announcements without a code deploy. Clearing the popup stops delivery immediately.
            </Text>
          </Card>

          <Card padding="lg" className="gap-4">
            <Text className="text-[#0f172a] font-geist-semibold text-[15px]">Popup configuration</Text>

            {isViewMode && currentPopup ? (
              <PopupViewMode popup={currentPopup} onEdit={() => setIsEditing(true)} />
            ) : (
              <>
                <Input
                  label="Title (required)"
                  value={form.title}
                  onChangeText={(value) => updateField("title", value)}
                  editable={!isViewMode}
                />
                <Input
                  label="Body (required)"
                  value={form.body}
                  onChangeText={(value) => updateField("body", value)}
                  editable={!isViewMode}
                />

                <View className="gap-2">
                  <Text className="text-md">Icon (optional)</Text>
                  <IconPicker
                    label="Icon (optional)"
                    value={form.iconValue}
                    onChange={(value) => updateField("iconValue", value)}
                    disabled={isViewMode}
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-md">CTA (optional)</Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      variant={!form.ctaEnabled ? "solid" : "outline"}
                      size="md"
                      disabled={isViewMode}
                      onPress={() => updateField("ctaEnabled", false)}
                    >
                      None
                    </Button>
                    {ACTIONS.map((action) => (
                      <Button
                        key={action}
                        variant={form.ctaEnabled && form.ctaAction === action ? "solid" : "outline"}
                        size="md"
                        disabled={isViewMode}
                        onPress={() => handleActionSelect(action)}
                      >
                        {action === "apply_coupon" ? "Apply coupon" : "Deeplink"}
                      </Button>
                    ))}
                  </View>
                  {form.ctaEnabled ? (
                    <>
                      <Input
                        label="CTA label"
                        value={form.ctaLabel}
                        onChangeText={(value) => updateField("ctaLabel", value)}
                        helper="Button text shown to users."
                        editable={!isViewMode}
                      />
                      <Input
                        label="CTA value"
                        value={form.ctaValue}
                        onChangeText={(value) => updateField("ctaValue", value)}
                        helper={
                          form.ctaAction === "apply_coupon"
                            ? "Coupon code (shown to cart)."
                            : "Path (/collections/..) or URL (https://example.com)."
                        }
                        editable={!isViewMode}
                      />
                    </>
                  ) : null}
                </View>

                <View className="gap-2">
                  <Text className="text-[#475569] text-[13px]">Scheduling</Text>
                  <DatePickerField
                    label="Start at"
                    value={form.startAt}
                    onChange={(value) => handleStartChange(value)}
                    minimumDate={startOfDay(new Date())}
                    disabled={isViewMode}
                  />
                  <DatePickerField label="End at" value={form.endAt} disabled />
                </View>

                <View className="gap-2">
                  <Text className="text-[#475569] text-[13px]">Audience</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {AUDIENCE_OPTIONS.map((option) => (
                      <Button
                        key={option}
                        variant={form.audience === option ? "solid" : "outline"}
                        size="md"
                        disabled={isViewMode}
                        onPress={() => handleAudienceSelect(option)}
                      >
                        {option === "all" ? "Everyone" : option === "authenticated" ? "Logged-in" : "Guests"}
                      </Button>
                    ))}
                  </View>
                </View>
              </>
            )}

            <View className="gap-2">
              {isViewMode ? (
                <Button
                  fullWidth
                  size="lg"
                  variant="danger"
                  onPress={handleClear}
                  isLoading={isClearing}
                  disabled={isClearing}
                >
                  Clear popup
                </Button>
              ) : (
                <>
                  <Button
                    fullWidth
                    size="lg"
                    variant="outline"
                    onPress={handlePreview}
                    disabled={!previewPopup || isSaving}
                    className="border-[#6b7280] bg-[#e5e7eb]"
                    textClassName="text-[#6b7280]"
                  >
                    Preview
                  </Button>
                  <Button fullWidth size="lg" onPress={handleSave} isLoading={isSaving}>
                    Save popup
                  </Button>
                </>
              )}
            </View>
          </Card>

          {missingConfig ? (
            <Card padding="lg" className="gap-2 bg-[#fef2f2] border border-[#fecaca]">
              <Text className="text-[#991b1b] font-geist-semibold text-[15px]">Configuration missing</Text>
              <Text className="text-[#b91c1c] text-[13px]">
                Set EXPO_PUBLIC_PUSH_WORKER_URL and EXPO_PUBLIC_PUSH_ADMIN_SECRET to manage popups.
              </Text>
            </Card>
          ) : null}

          {isLoading ? (
            <Card padding="lg" className="items-center gap-2">
              <ActivityIndicator size="small" color="#0f172a" />
              <Text className="text-[#475569] text-[13px]">Loading current popup…</Text>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {previewPopup ? (
        <InAppPopupModal
          popup={previewPopup}
          visible={previewVisible}
          onDismiss={() => setPreviewVisible(false)}
          onCtaPress={() => {
            setPreviewVisible(false)
            show({ title: "Preview CTA pressed", type: "info" })
          }}
        />
      ) : null}
    </>
  )
}
