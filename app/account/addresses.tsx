import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, RefreshControl, View } from "react-native"
import { router } from "expo-router"

import { useCustomerSession } from "@/lib/shopify/customer/hooks"
import { AddressRow } from "@/ui/account/AccountHome"
import { LoginCard } from "@/ui/account/LoginCard"
import { Screen } from "@/ui/layout/Screen"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { MenuBar } from "@/ui/nav/MenuBar"
import { H2, Muted } from "@/ui/primitives/Typography"

export default function AccountAddressesScreen() {
  const { status, customer, refresh, isFetchingCustomer } = useCustomerSession()
  const [refreshing, setRefreshing] = useState(false)

  const addresses = useMemo(() => (customer?.addresses?.nodes ?? []).filter(Boolean), [customer?.addresses?.nodes])
  const toLogin = useCallback(() => router.replace("/account/login" as const), [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

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
        <H2 className="text-[24px] leading-[32px]">Addresses</H2>
        {addresses.length === 0 ? (
          <Muted className="text-[14px]">Add a shipping address during checkout to save it here.</Muted>
        ) : (
          <View className="gap-4">
            {addresses.map((address: any) => (
              <AddressRow key={address.id} address={address} />
            ))}
          </View>
        )}
      </PageScrollView>
    </Screen>
  )
}
