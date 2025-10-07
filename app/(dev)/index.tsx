import { useCallback, useState } from "react"

import {
  getCustomerApiConfigOverride,
  getCustomerApiEndpoint,
  getOpenIdConfigOverride,
} from "@/lib/shopify/customer/discovery"
import { createCustomerGqlClient } from "@/lib/shopify/customer/client"
import { useCustomerSession } from "@/lib/shopify/customer/hooks"
import { SHOPIFY_DOMAIN } from "@/lib/shopify/env"
import { Screen } from "@/ui/layout/Screen"
import { H1, Text } from "@/ui/primitives/Typography"
import { Link } from "expo-router"
import { Pressable, View } from "react-native"

const HEALTH_CHECK_QUERY = /* GraphQL */ `
  query DevCustomerProbe {
    customer {
      id
    }
  }
`

type HealthState = {
  status: number | null
  errors: string[]
  note?: string
  errorMessage?: string
}

export default function DevHome() {
  const openIdOverride = getOpenIdConfigOverride()
  const customerOverride = getCustomerApiConfigOverride()
  const session = useCustomerSession()
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthState | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const runHealthCheck = useCallback(async () => {
    setIsChecking(true)
    try {
      const url = await getCustomerApiEndpoint()
      setEndpoint(url)
      if (session.status !== "authenticated" || !session.accessToken) {
        setHealth({ status: null, errors: [], note: "Log in to run the GraphQL probe." })
        return
      }
      const client = await createCustomerGqlClient(session.accessToken, SHOPIFY_DOMAIN)
      const rawResult: any = await client.rawRequest(HEALTH_CHECK_QUERY)
      const messages: string[] = Array.isArray(rawResult?.errors)
        ? rawResult.errors.map((entry: any) => entry?.message).filter(Boolean)
        : []
      setHealth({
        status: typeof rawResult?.status === "number" ? rawResult.status : 200,
        errors: messages,
      })
    } catch (error: any) {
      const response = error?.response
      const status = typeof response?.status === "number" ? response.status : error?.status ?? null
      const messages: string[] = Array.isArray(response?.errors)
        ? response.errors.map((entry: any) => entry?.message).filter(Boolean)
        : []
      setHealth({
        status,
        errors: messages,
        errorMessage: error instanceof Error ? error.message : "Health check failed",
        note:
          status === 404
            ? "Enable Customer accounts (new) and ensure Protected customer data access is granted (Level 1/2)."
            : undefined,
      })
    } finally {
      setIsChecking(false)
    }
  }, [session.accessToken, session.status])

  return (
    <Screen>
      <View className="p-6 gap-3">
        <H1>Dev</H1>
        <Link href="/(dev)/playground">
          <Text className="underline text-primary">Component Playground</Text>
        </Link>
        <Link href="/(dev)/pdp-demo">
          <Text className="underline text-primary">PDP Demo</Text>
        </Link>
        <View className="mt-4 gap-1">
          <Text className="font-geist-semibold">Discovery overrides</Text>
          <Text className="text-secondary text-[14px]">OpenID: {openIdOverride ? "enabled" : "disabled"}</Text>
          {openIdOverride ? (
            <Text className="text-secondary text-[13px]">authorize → {openIdOverride.authorization_endpoint}</Text>
          ) : null}
          <Text className="text-secondary text-[14px]">Customer API: {customerOverride ? "enabled" : "disabled"}</Text>
          {customerOverride ? (
            <Text className="text-secondary text-[13px]">graphql → {customerOverride.graphql_api}</Text>
          ) : null}
        </View>
        <View className="mt-4 gap-1">
          <Text className="font-geist-semibold">Health check</Text>
          <Pressable
            className="self-start px-3 py-2 rounded-md bg-primary/10"
            onPress={runHealthCheck}
            disabled={isChecking}
          >
            <Text className="text-primary font-geist-medium">
              {isChecking ? "Checking..." : "Run customer GraphQL probe"}
            </Text>
          </Pressable>
          {endpoint ? (
            <Text className="text-secondary text-[13px]">endpoint → {endpoint}</Text>
          ) : null}
          {health ? (
            <View className="gap-1">
              <Text className="text-secondary text-[13px]">
                Status: {health.status !== null ? health.status : "n/a"} · Errors: {health.errors.length > 0 ? "yes" : "none"}
              </Text>
              {health.errors.slice(0, 2).map((msg, index) => (
                <Text key={index} className="text-secondary text-[12px] leading-tight">
                  - {msg}
                </Text>
              ))}
              {health.errorMessage ? (
                <Text className="text-secondary text-[12px] leading-tight">Error: {health.errorMessage}</Text>
              ) : null}
              {health.note ? (
                <Text className="text-secondary text-[12px] leading-tight">{health.note}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  )
}
