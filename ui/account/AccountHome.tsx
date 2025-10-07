import { useState } from "react"
import { RefreshControl, View } from "react-native"

import type { CustomerAccountSnapshot } from "@/lib/shopify/customer/types"
import { formatMoney } from "@/lib/shopify/money"
import { Button } from "@/ui/primitives/Button"
import { H2, H3, Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { PageScrollView } from "@/ui/layout/PageScrollView"

export type AccountHomeProps = {
  customer: CustomerAccountSnapshot
  onViewOrders: () => void
  onViewAddresses: () => void
  onRefresh: () => Promise<void>
  refreshing: boolean
  onLogout: () => Promise<void>
}

const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })

export function AccountHome({
  customer,
  onViewOrders,
  onViewAddresses,
  onRefresh,
  refreshing,
  onLogout,
}: AccountHomeProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const fullName = customer?.displayName || "Account"
  const email = customer?.emailAddress?.emailAddress || "—"
  const tags = Array.isArray(customer?.tags) ? customer?.tags.filter(Boolean) : []
  const orders = (customer?.orders?.nodes ?? []).filter(Boolean)
  const addresses = (customer?.addresses?.nodes ?? []).filter(Boolean)
  const defaultAddress = customer?.defaultAddress || null

  const onLogoutPress = async () => {
    if (isLoggingOut) return
    try {
      setIsLoggingOut(true)
      await onLogout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <PageScrollView
      isFooterHidden
      contentContainerClassName="flex-1 px-5 pb-10 pt-6 gap-6"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card padding="lg" className="gap-4">
        <View className="gap-1">
          <H2 className="text-[24px] leading-[32px]">{fullName}</H2>
          <Text className="text-secondary text-[16px]">{email}</Text>
          {tags && tags.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 pt-2">
              {tags.map((tag) => (
                <View key={tag} className="rounded-full bg-muted px-3 py-1">
                  <Text className="text-[12px] uppercase tracking-wide text-secondary">{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {defaultAddress ? (
          <View className="rounded-xl border border-border px-4 py-3 gap-1">
            <Muted className="text-[12px] uppercase">Default address</Muted>
            <AddressRow address={defaultAddress} />
          </View>
        ) : null}
        <Button variant="outline" onPress={onViewAddresses} accessibilityLabel="Manage saved addresses">
          Manage Addresses
        </Button>
        <Button variant="outline" onPress={onViewOrders} accessibilityLabel="View recent orders">
          View Orders
        </Button>
        <Button
          variant="ghost"
          onPress={onLogoutPress}
          isLoading={isLoggingOut}
          accessibilityLabel="Log out of your customer account"
        >
          Log out
        </Button>
      </Card>

      <Card padding="lg" className="gap-4">
        <H3 className="text-[20px] leading-[24px]">Recent Orders</H3>
        {orders.length === 0 ? (
          <Muted className="text-[14px]">You haven’t placed any orders yet.</Muted>
        ) : (
          <View className="gap-4">
            {orders.slice(0, 3).map((order: any) => (
              <OrderRow key={order.id} order={order} />
            ))}
            {orders.length > 3 ? (
              <Button variant="link" onPress={onViewOrders} accessibilityLabel="See all orders">
                See all orders
              </Button>
            ) : null}
          </View>
        )}
      </Card>

      <Card padding="lg" className="gap-4">
        <H3 className="text-[20px] leading-[24px]">Saved Addresses</H3>
        {addresses.length === 0 ? (
          <Muted className="text-[14px]">Add an address at checkout to save it here.</Muted>
        ) : (
          <View className="gap-4">
            {addresses.slice(0, 3).map((address: any) => (
              <AddressRow key={address.id} address={address} />
            ))}
            {addresses.length > 3 ? (
              <Button variant="link" onPress={onViewAddresses} accessibilityLabel="See all addresses">
                See all addresses
              </Button>
            ) : null}
          </View>
        )}
      </Card>
    </PageScrollView>
  )
}

type OrderRowProps = {
  order: any
}

export function OrderRow({ order }: OrderRowProps) {
  const name = typeof order?.name === "string" && order.name.length > 0 ? order.name : (order?.id ?? "Order")
  const processedAt = order?.processedAt ? formatter.format(new Date(order.processedAt)) : "Processing"
  const money = order?.totalPriceSet?.presentmentMoney ?? null
  const total = formatMoney(money ?? null)
  const financial = order?.financialStatus ? order.financialStatus.replace(/_/g, " ") : null
  const fulfillment = order?.fulfillmentStatus ? order.fulfillmentStatus.replace(/_/g, " ") : null
  const status = [financial, fulfillment].filter(Boolean).join(" · ") || "Pending"

  return (
    <View className="rounded-xl border border-border px-4 py-3 gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-[16px] font-geist-semibold">{name}</Text>
        <Muted className="text-[13px]">{processedAt}</Muted>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[15px]">{total}</Text>
        <Muted className="text-[13px] capitalize">{status.toLowerCase()}</Muted>
      </View>
    </View>
  )
}

type AddressRowProps = {
  address: any
}

export function AddressRow({ address }: AddressRowProps) {
  const fullName = [address?.firstName, address?.lastName].filter(Boolean).join(" ")
  const lines = (address?.formatted ?? []).filter(Boolean)
  const locale = [address?.city, address?.province, address?.zip].filter(Boolean).join(", ")
  const country = address?.country

  return (
    <View className="rounded-xl border border-border px-4 py-3 gap-1">
      <Text className="text-[16px] font-geist-semibold">{fullName || "Unnamed"}</Text>
      {(lines.length > 0 ? lines : [address?.address1, address?.address2].filter(Boolean)).map(
        (line: string, idx: number) => (
          <Text key={`${address.id}-line-${idx}`} className="text-[14px] text-secondary">
            {line}
          </Text>
        ),
      )}
      {locale ? <Text className="text-[14px] text-secondary">{locale}</Text> : null}
      {country ? <Muted className="text-[13px] uppercase">{country}</Muted> : null}
    </View>
  )
}
