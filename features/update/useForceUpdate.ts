import { getAppMetadata } from "@/lib/diagnostics/appMetadata"
import { useEffect, useState } from "react"
import { Platform } from "react-native"

const BUNDLE_ID = "co.shopney.optionqaaf"

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na !== nb) return na - nb
  }
  return 0
}

type ForceUpdateState = {
  needsUpdate: boolean
  storeUrl: string | null
}

type UseForceUpdateOptions = {
  fontsReady: boolean
}

export function useForceUpdate({ fontsReady }: UseForceUpdateOptions): ForceUpdateState {
  const [state, setState] = useState<ForceUpdateState>({ needsUpdate: false, storeUrl: null })

  useEffect(() => {
    if (!fontsReady) return
    if (Platform.OS !== "ios") return
    const metadata = getAppMetadata()
    if (!metadata.version || metadata.ownership === "expo") return

    fetch(`https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}`)
      .then((res) => res.json())
      .then((data: any) => {
        const result = data?.results?.[0]
        const storeVersion: string | undefined = result?.version
        const storeUrl: string | null = result?.trackViewUrl ?? null
        if (!storeVersion || !metadata.version) return
        if (compareVersions(metadata.version, storeVersion) < 0) {
          setState({ needsUpdate: true, storeUrl })
        }
      })
      .catch(() => {})
  }, [fontsReady])

  return state
}
