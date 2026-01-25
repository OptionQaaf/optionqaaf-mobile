import * as Network from "expo-network"
import { useEffect, useState } from "react"

export type NetworkStatus = {
  isConnected: boolean | null
  isInternetReachable: boolean | null
  isExpensive: boolean | null
  type: string | null
}

const mapState = (value?: Network.NetworkState): NetworkStatus => ({
  isConnected: typeof value?.isConnected === "boolean" ? value.isConnected : null,
  isInternetReachable: typeof value?.isInternetReachable === "boolean" ? value.isInternetReachable : null,
  isExpensive: typeof value?.isExpensive === "boolean" ? value.isExpensive : null,
  type: value?.type ?? null,
})

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => mapState())

  useEffect(() => {
    let mounted = true

    const applyState = (value?: Network.NetworkState) => {
      if (!mounted) return
      setStatus(mapState(value))
    }

    const refresh = async () => {
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

    refresh()

    const listener =
      typeof Network.addNetworkStateListener === "function"
        ? Network.addNetworkStateListener((value) => applyState(value))
        : null

    return () => {
      mounted = false
      listener?.remove()
    }
  }, [])

  return status
}
