import { useCallback, useState } from "react"

import { startLogin } from "@/lib/shopify/customer/auth"
import { customerQuery } from "@/lib/shopify/customer/client"
import { CustomerApiError } from "@/lib/shopify/customer/errors"
import {
  getCustomerApiConfigOverride,
  getCustomerApiEndpoint,
  getOpenIdConfigOverride,
} from "@/lib/shopify/customer/discovery"
import { useCustomerSession } from "@/lib/shopify/customer/hooks"
import { caapiSmokeTest } from "@/lib/shopify/customer/smoke"
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
  const sessionStatus = session.status
  const refreshSession = session.refresh
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthState | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [smoke, setSmoke] = useState<{
    loading: boolean
    customer?: { id: string; firstName: string | null; lastName: string | null }
    error?: string
  } | null>(null)

  const runHealthCheck = useCallback(async () => {
    setIsChecking(true)
    try {
      const url = await getCustomerApiEndpoint()
      setEndpoint(url)
      if (sessionStatus !== "authenticated") {
        setHealth({ status: null, errors: [], note: "Log in to run the GraphQL probe." })
        return
      }
      const result = await customerQuery<{ customer: { id: string | null } | null }>(HEALTH_CHECK_QUERY)
      const messages = Array.isArray(result.errors)
        ? (result.errors.map((entry) => entry?.message).filter(Boolean) ?? [])
        : []
      setHealth({
        status: 200,
        errors: messages,
        note: !result.data?.customer ? "Customer query returned no data (is the account logged in?)" : undefined,
      })
    } catch (error) {
      if (error instanceof CustomerApiError) {
        const messages = Array.isArray(error.errors)
          ? (error.errors as { message?: string }[]).map((entry) => entry?.message).filter(Boolean)
          : []
        setHealth({
          status: error.status ?? null,
          errors: messages,
          errorMessage: error.message,
          note:
            error.status === 404
              ? "Enable Customer accounts (new) and ensure Protected customer data access is granted (Level 1/2)."
              : undefined,
        })
      } else {
        setHealth({
          status: null,
          errors: [],
          errorMessage: error instanceof Error ? error.message : "Health check failed",
        })
      }
    } finally {
      setIsChecking(false)
    }
  }, [sessionStatus])

  const runSmokeTest = useCallback(async () => {
    setSmoke({ loading: true })
    try {
      await startLogin()
      await refreshSession()
      const customer = await caapiSmokeTest()
      setSmoke({ loading: false, customer })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Smoke test failed"
      setSmoke({ loading: false, error: message })
    }
  }, [refreshSession])

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
          {endpoint ? <Text className="text-secondary text-[13px]">endpoint → {endpoint}</Text> : null}
          {health ? (
            <View className="gap-1">
              <Text className="text-secondary text-[13px]">
                Status: {health.status !== null ? health.status : "n/a"} · Errors:{" "}
                {health.errors.length > 0 ? "yes" : "none"}
              </Text>
              {health.errors.slice(0, 2).map((msg, index) => (
                <Text key={index} className="text-secondary text-[12px] leading-tight">
                  - {msg}
                </Text>
              ))}
              {health.errorMessage ? (
                <Text className="text-secondary text-[12px] leading-tight">Error: {health.errorMessage}</Text>
              ) : null}
              {health.note ? <Text className="text-secondary text-[12px] leading-tight">{health.note}</Text> : null}
            </View>
          ) : null}
        </View>
        <View className="mt-4 gap-1">
          <Text className="font-geist-semibold">Smoke test</Text>
          <Pressable
            className="self-start px-3 py-2 rounded-md bg-primary/10"
            onPress={runSmokeTest}
            disabled={smoke?.loading}
          >
            <Text className="text-primary font-geist-medium">
              {smoke?.loading ? "Running..." : "Login + run smoke test"}
            </Text>
          </Pressable>
          {smoke?.customer ? (
            <Text className="text-secondary text-[13px]">
              Customer → {smoke.customer.firstName || ""} {smoke.customer.lastName || ""} ({smoke.customer.id})
            </Text>
          ) : null}
          {smoke?.error ? <Text className="text-secondary text-[12px] leading-tight">Error: {smoke.error}</Text> : null}
        </View>
      </View>
    </Screen>
  )
}
