import { useCustomerProfile } from "@/features/account/api"
import { useShopifyAuth } from "@/features/auth/useShopifyAuth"
import {
  fetchCustomerPersonalizationProfile,
  mergeLocalAndRemoteProfiles,
  setCustomerPersonalizationProfile,
} from "@/lib/shopify/customer/personalizationProfile"
import { getPersonalizationEventsState } from "@/store/personalizationEvents"
import { useEffect, useRef } from "react"
import { AppState } from "react-native"

type UsePersonalizationSyncServiceOptions = {
  enabled: boolean
}

type SyncReason = "startup" | "login" | "active" | "background" | "scheduled" | "threshold"

type SyncIntent = {
  reason: SyncReason
  forcePull?: boolean
  forcePush?: boolean
}

const UNSYNCED_PUSH_THRESHOLD = 25
const PUSH_DEBOUNCE_MS = 2 * 60 * 1000
const PUSH_MAX_DELAY_MS = 15 * 60 * 1000
const ACTIVE_TICK_MS = 2 * 60 * 1000
const PULL_MIN_INTERVAL_MS = 5 * 60 * 1000
const RETRY_INITIAL_MS = 30 * 1000
const RETRY_MAX_MS = 15 * 60 * 1000

function withJitter(ms: number): number {
  const jitter = Math.floor(ms * 0.15)
  return ms + Math.floor(Math.random() * Math.max(jitter, 1))
}

export function usePersonalizationSyncService({ enabled }: UsePersonalizationSyncServiceOptions) {
  const { isAuthenticated, initializing } = useShopifyAuth()
  const { data: profile, isFetched: profileFetched } = useCustomerProfile({ enabled: enabled && isAuthenticated })

  const inFlightRef = useRef(false)
  const pendingIntentRef = useRef<SyncIntent | null>(null)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPullAtRef = useRef<number>(0)
  const retryDelayRef = useRef<number>(RETRY_INITIAL_MS)

  useEffect(() => {
    return () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current)
        pushTimerRef.current = null
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled || initializing || !isAuthenticated || !profile?.id) return
    if (!profileFetched) return

    let cancelled = false

    const canRun = () => enabled && !initializing && isAuthenticated && !!profile?.id && profileFetched

    const scheduleRetry = () => {
      if (retryTimerRef.current || cancelled) return
      const delay = withJitter(retryDelayRef.current)
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null
        void runSync({ reason: "scheduled" })
      }, delay)
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, RETRY_MAX_MS)
    }

    const runSync = async (intent: SyncIntent) => {
      if (!canRun()) return

      if (inFlightRef.current) {
        pendingIntentRef.current = intent
        return
      }

      inFlightRef.current = true

      try {
        const now = Date.now()
        const shouldPull =
          intent.forcePull ||
          intent.reason === "startup" ||
          intent.reason === "login" ||
          intent.reason === "active" ||
          now - lastPullAtRef.current >= PULL_MIN_INTERVAL_MS

        let snapshot = getPersonalizationEventsState()
        let remoteWasEmptyAfterPull = false

        if (shouldPull) {
          const remote = await fetchCustomerPersonalizationProfile()
          if (cancelled) return
          remoteWasEmptyAfterPull = !remote || remote.eventLog.length === 0

          const merged = mergeLocalAndRemoteProfiles(snapshot.profile, remote)
          snapshot.replaceProfile(merged, { markUnsynced: snapshot.hasUnsyncedChanges })
          lastPullAtRef.current = Date.now()
          snapshot = getPersonalizationEventsState()
        }

        const unsyncedCount = snapshot.getUnsyncedEventCount()
        const hasUnsynced = snapshot.hasUnsyncedChanges && unsyncedCount > 0
        const hasLocalEvents = snapshot.events.length > 0
        const lastSyncedAtMs = snapshot.lastSyncedAt ? new Date(snapshot.lastSyncedAt).getTime() : 0
        const staleForPush = !Number.isFinite(lastSyncedAtMs) || now - lastSyncedAtMs >= PUSH_MAX_DELAY_MS

        const shouldPush =
          (hasUnsynced &&
            (intent.forcePush ||
              intent.reason === "login" ||
              intent.reason === "background" ||
              unsyncedCount >= UNSYNCED_PUSH_THRESHOLD ||
              staleForPush)) ||
          (shouldPull && remoteWasEmptyAfterPull && hasLocalEvents)

        if (shouldPush) {
          await setCustomerPersonalizationProfile(snapshot.profile, profile.id)
          if (cancelled) return
          snapshot.markSynced()
          retryDelayRef.current = RETRY_INITIAL_MS
        }

        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current)
          retryTimerRef.current = null
        }
      } catch (error) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn("[personalization-tracking] sync failed", error)
        }
        scheduleRetry()
      } finally {
        inFlightRef.current = false
        if (pendingIntentRef.current && !cancelled) {
          const pending = pendingIntentRef.current
          pendingIntentRef.current = null
          void runSync(pending)
        }
      }
    }

    const scheduleDebouncedPush = () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current)
      }
      pushTimerRef.current = setTimeout(() => {
        pushTimerRef.current = null
        void runSync({ reason: "threshold" })
      }, PUSH_DEBOUNCE_MS)
    }

    void runSync({ reason: "startup", forcePull: true })

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void runSync({ reason: "active", forcePull: true })
        return
      }

      if (nextState === "inactive" || nextState === "background") {
        void runSync({ reason: "background", forcePush: true })
      }
    })

    const interval = setInterval(() => {
      const snapshot = getPersonalizationEventsState()
      const unsyncedCount = snapshot.getUnsyncedEventCount()
      if (unsyncedCount >= UNSYNCED_PUSH_THRESHOLD) {
        void runSync({ reason: "threshold", forcePush: true })
        return
      }
      if (snapshot.hasUnsyncedChanges && unsyncedCount > 0) {
        scheduleDebouncedPush()
        return
      }
      void runSync({ reason: "scheduled" })
    }, ACTIVE_TICK_MS)

    return () => {
      cancelled = true
      appStateSub.remove()
      clearInterval(interval)
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current)
        pushTimerRef.current = null
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [enabled, initializing, isAuthenticated, profile?.id, profileFetched])
}
