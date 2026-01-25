import { getAppMetadata } from "@/lib/diagnostics/appMetadata"
import { hasSeenPopup, markPopupSeen } from "@/lib/popup/localSeen"
import { getViewerKey } from "@/lib/popup/identity"
import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import { fetchCurrentPopup, markPopupSeenRemote } from "@/features/popup/api"
import { useEffect, useMemo, useRef } from "react"
import { usePopupStore } from "@/store/popup"

type UsePopupServiceOptions = {
  fontsReady: boolean
  navigationReady: boolean
}

export function usePopupService({ fontsReady, navigationReady }: UsePopupServiceOptions) {
  const { isAuthenticated, initializing } = useShopifyAuth()
  const { data: profile, isFetched: profileFetched } = useCustomerProfile({ enabled: isAuthenticated })
  const viewerKey = useMemo(() => {
    if (isAuthenticated && !profileFetched) return null
    return getViewerKey(profile?.id ?? null)
  }, [profile?.id, isAuthenticated, profileFetched])
  const lastViewerKey = useRef<string | null>(null)

  useEffect(() => {
    if (!fontsReady || !navigationReady || initializing) return
    if (!viewerKey) return
    if (lastViewerKey.current && lastViewerKey.current !== viewerKey) {
      usePopupStore.getState().clearPopup()
    }
    if (lastViewerKey.current === viewerKey) return
    lastViewerKey.current = viewerKey
    let cancelled = false

    const run = async () => {
      const metadata = getAppMetadata()
      const popup = await fetchCurrentPopup({
        viewerKey,
        appVersion: metadata.version ?? undefined,
      })
      if (cancelled || !popup) return
      if (hasSeenPopup(viewerKey, popup.id, popup.updatedAt)) return
      markPopupSeen(viewerKey, popup.id, popup.updatedAt)
      if (cancelled) return
      usePopupStore.getState().setPopup(popup)
      void markPopupSeenRemote(popup.id, viewerKey)
    }

    run()

    return () => {
      cancelled = true
    }
  }, [fontsReady, navigationReady, initializing, viewerKey])
}
