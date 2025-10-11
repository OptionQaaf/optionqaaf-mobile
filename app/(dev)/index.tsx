import { useCallback, useState } from "react"

import { useAuth } from "@/context/AuthContext"
import { getCustomerAuthConfig } from "@/lib/config/customerAuth"
import { discoverCustomerAPI } from "@/lib/customerAuth/discovery"
import { getMe, CustomerApiError, InvalidTokenError } from "@/lib/customerApi"
import type { Customer } from "@/lib/customerApi"
import { Screen } from "@/ui/layout/Screen"
import { H1, Text } from "@/ui/primitives/Typography"
import { Link } from "expo-router"
import { Pressable, View } from "react-native"

type HealthState = {
  status: number | null
  errors: string[]
  note?: string
  errorMessage?: string
}

export default function DevHome() {
  const config = getCustomerAuthConfig()
  const openIdOverride = config.overrides.authorizationEndpoint || config.overrides.openIdConfigurationUrl
  const customerOverride = config.overrides.customerApiEndpoint
  const { status: sessionStatus, loginWithOTP, reloadCustomer } = useAuth()
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthState | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [smoke, setSmoke] = useState<{
    loading: boolean
    customer?: Customer
    error?: string
  } | null>(null)

  const runHealthCheck = useCallback(async () => {
    setIsChecking(true)
    try {
      const discovery = await discoverCustomerAPI()
      setEndpoint(discovery.graphqlApi)
      if (sessionStatus !== "authenticated") {
        setHealth({ status: null, errors: [], note: "Log in to run the GraphQL probe." })
        return
      }
      const result = await getMe()
      const messages: string[] = []
      setHealth({
        status: 200,
        errors: messages,
        note: !result ? "Customer query returned no data (is the account logged in?)" : undefined,
      })
    } catch (error) {
      if (error instanceof CustomerApiError) {
        const messages = Array.isArray(error.errors)
          ? (error.errors as { message?: string }[])
              .map((entry) => entry?.message)
              .filter((msg): msg is string => typeof msg === "string")
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
      } else if (error instanceof InvalidTokenError) {
        setHealth({
          status: 401,
          errors: ["Access token rejected"],
          errorMessage: error.message,
          note: "Re-authenticate to refresh the token.",
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
      await loginWithOTP()
      await reloadCustomer()
      const customer = await getMe()
      setSmoke({ loading: false, customer })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Smoke test failed"
      setSmoke({ loading: false, error: message })
    }
  }, [loginWithOTP, reloadCustomer])

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
          <Text className="text-secondary text-[14px]">OpenID override: {openIdOverride ? "enabled" : "disabled"}</Text>
          {openIdOverride ? <Text className="text-secondary text-[13px]">source → {openIdOverride}</Text> : null}
          <Text className="text-secondary text-[14px]">
            Customer API override: {customerOverride ? "enabled" : "disabled"}
          </Text>
          {customerOverride ? <Text className="text-secondary text-[13px]">graphql → {customerOverride}</Text> : null}
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
