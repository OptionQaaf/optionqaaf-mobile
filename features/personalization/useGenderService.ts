import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { type GenderChoice } from "@/lib/personalization/gender"
import { fetchCustomerGender, setCustomerGender } from "@/lib/shopify/customer/personalization"
import { isOnboardingDone } from "@/lib/storage/flags"
import { usePersonalization } from "@/store/personalization"
import { useCallback, useEffect, useState } from "react"

type UseGenderServiceOptions = {
  enabled: boolean
}

export function useGenderService({ enabled }: UseGenderServiceOptions) {
  const { isAuthenticated, initializing } = useShopifyAuth()
  const { data: profile, isFetched: profileFetched } = useCustomerProfile({ enabled: isAuthenticated && enabled })
  const gender = usePersonalization((state) => state.gender)
  const setGender = usePersonalization((state) => state.setGender)

  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState<GenderChoice | null>(null)

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

    const run = async () => {
      if (!isAuthenticated) {
        if (!cancelled) setVisible(!gender)
        return
      }

      try {
        const remoteGender = await fetchCustomerGender()
        if (cancelled) return

        if (remoteGender) {
          if (remoteGender !== gender) {
            setGender(remoteGender)
          }
          setVisible(false)
          return
        }

        if (gender && profile?.id) {
          try {
            await setCustomerGender(gender, profile.id)
          } catch (error) {
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.warn("[gender] Failed syncing local gender to Shopify", error)
            }
          }
          if (!cancelled) setVisible(false)
          return
        }

        if (!cancelled) setVisible(true)
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[gender] Failed reading customer gender from Shopify", error)
        }
        if (!cancelled) setVisible(!gender)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [
    enabled,
    onboardingChecked,
    onboardingDone,
    initializing,
    isAuthenticated,
    profileFetched,
    profile?.id,
    gender,
    setGender,
  ])

  const chooseGender = useCallback(
    async (nextGender: GenderChoice) => {
      if (saving) return

      setSaving(nextGender)
      setGender(nextGender)
      setVisible(false)

      if (!isAuthenticated) {
        setSaving(null)
        return
      }

      try {
        if (profile?.id) {
          await setCustomerGender(nextGender, profile.id)
        }
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[gender] Failed writing customer gender to Shopify", error)
        }
      } finally {
        setSaving(null)
      }
    },
    [isAuthenticated, profile?.id, saving, setGender],
  )

  return {
    visible,
    saving,
    chooseGender,
  }
}
