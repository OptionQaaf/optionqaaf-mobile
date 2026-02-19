import { getAppMetadata } from "@/lib/diagnostics/appMetadata"
import { hasSeenPopup, markPopupSeen } from "@/lib/popup/localSeen"
import { getViewerKey } from "@/lib/popup/identity"
import { isOnboardingDone } from "@/lib/storage/flags"
import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { fetchCurrentPopup, markPopupSeenRemote } from "@/features/popup/api"
import { useEffect, useRef, useState } from "react"
import { usePopupStore } from "@/store/popup"

type UsePopupServiceOptions = {
  fontsReady: boolean
  navigationReady: boolean
  splashReady: boolean
}

export function usePopupService({ fontsReady, navigationReady, splashReady }: UsePopupServiceOptions) {
  const { isAuthenticated, initializing } = useShopifyAuth()
  const { data: profile, isFetched: profileFetched } = useCustomerProfile({ enabled: isAuthenticated })
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const lastViewerKey = useRef<string | null>(null)

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
    if (!onboardingChecked) return
    if (!onboardingDone) {
      lastViewerKey.current = null
      usePopupStore.getState().clearPopup()
      return
    }
    if (!fontsReady || !navigationReady || !splashReady || initializing) return
    if (isAuthenticated && !profileFetched) return
    let cancelled = false

    const run = async () => {
      const viewerKey = await getViewerKey(profile?.id ?? null)
      if (cancelled || !viewerKey) return
      if (lastViewerKey.current && lastViewerKey.current !== viewerKey) {
        usePopupStore.getState().clearPopup()
      }
      if (lastViewerKey.current === viewerKey) return
      lastViewerKey.current = viewerKey
      const metadata = getAppMetadata()
      const popup = await fetchCurrentPopup({
        viewerKey,
        appVersion: metadata.version ?? undefined,
      })
      if (cancelled || !popup) return
      if (await hasSeenPopup(viewerKey, popup.id, popup.updatedAt)) return
      await markPopupSeen(viewerKey, popup.id, popup.updatedAt)
      if (cancelled) return
      usePopupStore.getState().setPopup(popup)
      void markPopupSeenRemote(popup.id, viewerKey)
    }

    run()

    return () => {
      cancelled = true
    }
  }, [
    fontsReady,
    navigationReady,
    splashReady,
    initializing,
    isAuthenticated,
    onboardingChecked,
    onboardingDone,
    profile?.id,
    profileFetched,
  ])
}
