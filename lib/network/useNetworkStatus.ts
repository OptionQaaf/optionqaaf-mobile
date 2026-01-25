import type { NetworkState } from "expo-network"
import { useEffect, useState } from "react"
import { NativeModules } from "react-native"

export type NetworkStatus = {
  isConnected: boolean | null
  isInternetReachable: boolean | null
  type: string | null
}

const mapState = (value?: NetworkState): NetworkStatus => ({
  isConnected: typeof value?.isConnected === "boolean" ? value.isConnected : null,
  isInternetReachable: typeof value?.isInternetReachable === "boolean" ? value.isInternetReachable : null,
  type: value?.type ?? null,
})

type NetworkModule = typeof import("expo-network")

const hasNativeNetworkModule = () => Boolean(NativeModules.ExpoNetwork)
let cachedNetworkModule: NetworkModule | null = null
let pendingNetworkModule: Promise<NetworkModule | null> | null = null

async function ensureNetworkModule(): Promise<NetworkModule | null> {
  if (!hasNativeNetworkModule()) {
    return null
  }
  if (cachedNetworkModule) {
    return cachedNetworkModule
  }
  if (!pendingNetworkModule) {
    pendingNetworkModule = import("expo-network")
      .then((mod) => {
        cachedNetworkModule = mod
        return mod
      })
      .catch(() => null)
  }
  return pendingNetworkModule
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => mapState())

  useEffect(() => {
    if (!hasNativeNetworkModule()) {
      return
    }

    let mounted = true
    type NetworkListener = ReturnType<NonNullable<NetworkModule["addNetworkStateListener"]>>
    let listener: NetworkListener | null = null

    const applyState = (value?: NetworkState) => {
      if (!mounted) return
      setStatus(mapState(value))
    }

    const refresh = async (Network: NetworkModule) => {
      if (typeof Network.getNetworkStateAsync !== "function") {
        return
      }
      try {
        const value = await Network.getNetworkStateAsync()
        applyState(value)
      } catch {
        applyState()
      }
    }

    const run = async () => {
      const Network = await ensureNetworkModule()
      if (!mounted || !Network) return
      await refresh(Network)
      if (typeof Network.addNetworkStateListener === "function") {
        listener = Network.addNetworkStateListener((value) => applyState(value))
      }
    }

    void run()

    return () => {
      mounted = false
      listener?.remove()
    }
  }, [])

  return status
}
