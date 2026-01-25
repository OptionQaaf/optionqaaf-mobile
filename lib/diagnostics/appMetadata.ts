import * as Application from "expo-application"
import { useMemo } from "react"

export type AppMetadata = {
  appName: string | null
  version: string | null
  buildNumber: string | null
  applicationId: string | null
  ownership: string | null
}

let cachedMetadata: AppMetadata | null = null

export function getAppMetadata(): AppMetadata {
  if (cachedMetadata) return cachedMetadata

  cachedMetadata = {
    appName: Application.applicationName ?? null,
    version: Application.nativeApplicationVersion ?? null,
    buildNumber: Application.nativeBuildVersion ?? null,
    applicationId: Application.applicationId ?? null,
    ownership: Application.appOwnership ?? null,
  }

  return cachedMetadata
}

export function useAppMetadata(): AppMetadata {
  return useMemo(() => getAppMetadata(), [])
}
