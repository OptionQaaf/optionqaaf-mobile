import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, RefreshControl, View } from "react-native"
import { router } from "expo-router"

import { useAuth } from "@/context/AuthContext"
import { OrderRow } from "@/ui/account/AccountHome"
import { LoginCard } from "@/ui/account/LoginCard"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { H2, Muted } from "@/ui/primitives/Typography"

export default function AccountOrdersScreen() {
  const { status, customer, reloadCustomer, isFetchingCustomer } = useAuth()
  const [refreshing, setRefreshing] = useState(false)

  const orders = useMemo(
    () => (customer?.orders?.edges ?? []).map((edge) => edge?.node).filter(Boolean),
    [customer?.orders?.edges],
  )
  const toLogin = useCallback(() => router.replace("/account/login" as const), [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await reloadCustomer()
    } finally {
      setRefreshing(false)
    }
  }, [reloadCustomer])

  if (status === "loading") {
    return (
      <Screen>
        <MenuBar back />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#0B0B0B" />
        </View>
      </Screen>
    )
  }

  if (status === "unauthenticated") {
    return (
      <Screen>
        <MenuBar back />
        <View className="flex-1 px-5 pt-6">
          <LoginCard onLogin={toLogin} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <MenuBar back />
      <PageScrollView
        isFooterHidden
        contentContainerClassName="flex-1 px-5 pb-10 pt-6 gap-4"
        refreshControl={<RefreshControl refreshing={refreshing || isFetchingCustomer} onRefresh={onRefresh} />}
      >
        <H2 className="text-[24px] leading-[32px]">Orders</H2>
        {orders.length === 0 ? (
          <Muted className="text-[14px]">You don’t have any orders yet.</Muted>
        ) : (
          <View className="gap-4">
            {orders.map((order: any) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </View>
        )}
      </PageScrollView>
    </Screen>
  )
}
