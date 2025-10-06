import { useCallback, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { router } from "expo-router"

import { useCustomerSession } from "@/lib/shopify/customer/hooks"
import { CustomerApiError } from "@/lib/shopify/customer/client"
import { AccountHome } from "@/ui/account/AccountHome"
import { LoginCard } from "@/ui/account/LoginCard"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Card } from "@/ui/surfaces/Card"
import { H3, Text } from "@/ui/primitives/Typography"

export default function AccountScreen() {
  const { status, customer, refresh, logout, isFetchingCustomer, error } = useCustomerSession()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  const goToLogin = useCallback(() => router.push("/account/login" as const), [])
  const goToOrders = useCallback(() => router.push("/account/orders" as const), [])
  const goToAddresses = useCallback(() => router.push("/account/addresses" as const), [])

  const isLoading = status === "loading"
  const showLogin = status === "unauthenticated"
  const customerError = error instanceof CustomerApiError ? error : null

  return (
    <Screen>
      <MenuBar />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#0B0B0B" />
        </View>
      ) : showLogin ? (
        <View className="flex-1 px-5 pt-6">
          <LoginCard onLogin={goToLogin} />
        </View>
      ) : customerError ? (
        <PageScrollView isFooterHidden contentContainerClassName="flex-1 px-5 pt-6 pb-8">
          <Card padding="lg" className="gap-3">
            <H3 className="text-[20px] leading-[26px]">Account data unavailable</H3>
            <Text className="text-secondary text-[15px]">
              We authenticated you, but the Shopify Customer Account API is returning a 404 error. Double-check that new
              customer accounts are enabled for this store and try again later.
            </Text>
            <Text className="text-secondary text-[13px]">
              Technical detail: {customerError.message || "Customer API responded with 404"}
            </Text>
          </Card>
        </PageScrollView>
      ) : (
        <AccountHome
          customer={customer}
          onViewOrders={goToOrders}
          onViewAddresses={goToAddresses}
          onRefresh={onRefresh}
          refreshing={refreshing || isFetchingCustomer}
          onLogout={logout}
        />
      )}
    </Screen>
  )
}
