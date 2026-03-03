import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { type BirthDateValue } from "@/lib/personalization/birthDate"
import { ensureBirthDatePromptTrigger, markBirthDatePromptShown } from "@/lib/personalization/birthDatePrompt"
import { fetchCustomerBirthDate, setCustomerBirthDate } from "@/lib/shopify/customer/personalization"
import { isOnboardingDone } from "@/lib/storage/flags"
import { usePersonalization } from "@/store/personalization"
import { useCallback, useEffect, useState } from "react"

type UseBirthDateServiceOptions = {
  enabled: boolean
}

export function useBirthDateService({ enabled }: UseBirthDateServiceOptions) {
  const { isAuthenticated, initializing } = useShopifyAuth()
  const { data: profile, isFetched: profileFetched } = useCustomerProfile({ enabled: enabled && isAuthenticated })
  const birthDate = usePersonalization((state) => state.birthDate)
  const setBirthDate = usePersonalization((state) => state.setBirthDate)

  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState<BirthDateValue | null>(null)

  useEffect(() => {
    let active = true
    isOnboardingDone()
      .then((done) => {
        if (!active) return
        setOnboardingDone(done)
        setOnboardingChecked(true)
      })
      .catch(() => {
        if (!active) return
        setOnboardingChecked(true)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || !onboardingChecked) return
    if (!onboardingDone) {
      setVisible(false)
      return
    }
    if (initializing) return
    if (isAuthenticated && !profileFetched) return

    let cancelled = false
    let promptTimer: ReturnType<typeof setTimeout> | null = null

    const clearPromptTimer = () => {
      if (!promptTimer) return
      clearTimeout(promptTimer)
      promptTimer = null
    }

    const applyPromptVisibility = (triggerAt: number | null, shownOnce: boolean) => {
      clearPromptTimer()
      if (shownOnce || !triggerAt) {
        setVisible(false)
        return
      }

      const now = Date.now()
      if (now >= triggerAt) {
        setVisible(true)
        return
      }

      promptTimer = setTimeout(
        () => {
          if (!cancelled) {
            setVisible(true)
          }
          promptTimer = null
        },
        Math.max(triggerAt - now, 0),
      )
      setVisible(false)
    }

    const run = async () => {
      if (!isAuthenticated) {
        if (birthDate) {
          clearPromptTimer()
          setVisible(false)
          return
        }
        const promptState = ensureBirthDatePromptTrigger(Date.now())
        if (!cancelled) {
          applyPromptVisibility(promptState.triggerAt, promptState.shownOnce)
        }
        return
      }

      try {
        const remoteBirthDate = await fetchCustomerBirthDate()
        if (cancelled) return

        if (remoteBirthDate) {
          clearPromptTimer()
          if (remoteBirthDate !== birthDate) {
            setBirthDate(remoteBirthDate)
          }
          setVisible(false)
          return
        }

        if (birthDate && profile?.id) {
          try {
            await setCustomerBirthDate(birthDate, profile.id)
          } catch (error) {
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.warn("[birth-date] Failed syncing local birth date to Shopify", error)
            }
          }
          if (!cancelled) setVisible(false)
          return
        }

        const promptState = ensureBirthDatePromptTrigger(Date.now())
        if (!cancelled) {
          applyPromptVisibility(promptState.triggerAt, promptState.shownOnce)
        }
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[birth-date] Failed reading customer birth date from Shopify", error)
        }
        if (birthDate) {
          clearPromptTimer()
          if (!cancelled) setVisible(false)
          return
        }
        const promptState = ensureBirthDatePromptTrigger(Date.now())
        if (!cancelled) {
          applyPromptVisibility(promptState.triggerAt, promptState.shownOnce)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      clearPromptTimer()
    }
  }, [
    birthDate,
    enabled,
    initializing,
    isAuthenticated,
    onboardingChecked,
    onboardingDone,
    profile?.id,
    profileFetched,
    setBirthDate,
  ])

  const chooseBirthDate = useCallback(
    async (nextBirthDate: BirthDateValue) => {
      if (saving) return

      setSaving(nextBirthDate)
      setBirthDate(nextBirthDate)
      setVisible(false)
      markBirthDatePromptShown()

      if (!isAuthenticated) {
        setSaving(null)
        return
      }

      try {
        if (profile?.id) {
          await setCustomerBirthDate(nextBirthDate, profile.id)
        }
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[birth-date] Failed writing customer birth date to Shopify", error)
        }
      } finally {
        setSaving(null)
      }
    },
    [isAuthenticated, profile?.id, saving, setBirthDate],
  )

  const dismissPrompt = useCallback(() => {
    markBirthDatePromptShown()
    setVisible(false)
  }, [])

  return {
    visible,
    saving,
    birthDate,
    chooseBirthDate,
    dismissPrompt,
  }
}
