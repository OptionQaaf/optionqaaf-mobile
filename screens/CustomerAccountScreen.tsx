import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { logout } from "@/lib/shopify/customer/auth"
import { createCustomerGraphQLClient } from "@/lib/shopify/customer/client"
import { getShopifyCustomerConfig } from "@/lib/shopify/customer/config"
import { GraphQLErrorWithStatus } from "@/lib/shopify/customer/errors"
import { CUSTOMER_ADDRESSES_QUERY, CUSTOMER_BASICS_QUERY, CUSTOMER_ORDERS_QUERY } from "@/lib/shopify/customer/queries"
import type {
  CustomerAccountSnapshot,
  CustomerAddressesQueryResult,
  CustomerBasicsQueryResult,
  CustomerOrdersQueryResult,
} from "@/lib/shopify/customer/types"

type ScreenState = {
  loading: boolean
  refreshing: boolean
  error: string | null
  customer: CustomerAccountSnapshot
}

export function CustomerAccountScreen() {
  const router = useRouter()
  const { shopDomain } = getShopifyCustomerConfig()
  const [state, setState] = useState<ScreenState>({
    loading: true,
    refreshing: false,
    error: null,
    customer: null,
  })

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      setState((prev) => ({
        ...prev,
        error: null,
        loading: opts?.refresh ? prev.loading : true,
        refreshing: !!opts?.refresh,
      }))
      try {
        const client = await createCustomerGraphQLClient(shopDomain)
        const fetch = client.fetchGraphQL

        const [basics, addresses, orders] = await Promise.all([
          fetch<CustomerBasicsQueryResult>("CustomerBasics", CUSTOMER_BASICS_QUERY),
          fetch<CustomerAddressesQueryResult>("CustomerAddresses", CUSTOMER_ADDRESSES_QUERY),
          fetch<CustomerOrdersQueryResult>("CustomerOrders", CUSTOMER_ORDERS_QUERY),
        ])

        const customer = basics.customer
        const next: CustomerAccountSnapshot = customer
          ? {
              ...customer,
              addresses: addresses.customer?.addresses ?? { nodes: [] },
              orders: orders.customer?.orders ?? { nodes: [] },
            }
          : null

        setState({ loading: false, refreshing: false, error: null, customer: next })
      } catch (error) {
        const message =
          error instanceof GraphQLErrorWithStatus
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to load customer data"
        setState((prev) => ({ ...prev, loading: false, refreshing: false, error: message }))
      }
    },
    [shopDomain],
  )

  useEffect(() => {
    load().catch((error) => {
      console.warn("[CustomerAccountScreen] initial load failed", error)
    })
  }, [load])

  const onRefresh = useCallback(async () => {
    await load({ refresh: true })
  }, [load])

  const onSignOut = useCallback(async () => {
    await logout(shopDomain)
    router.replace("/test/customer-login")
  }, [router, shopDomain])

  const orders = useMemo(() => (state.customer?.orders?.nodes ?? []).filter(Boolean), [state.customer?.orders?.nodes])
  const addresses = useMemo(
    () => (state.customer?.addresses?.nodes ?? []).filter(Boolean),
    [state.customer?.addresses?.nodes],
  )

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f9fafb" }}
      contentContainerStyle={{ padding: 24, gap: 24 }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={onRefresh} />}
    >
      {state.loading ? (
        <View style={{ paddingVertical: 80, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 12, color: "#4b5563" }}>Loading customer account…</Text>
        </View>
      ) : null}

      {state.error ? (
        <View style={{ backgroundColor: "#fef2f2", padding: 16, borderRadius: 16 }}>
          <Text style={{ color: "#991b1b", fontWeight: "600", fontSize: 16 }}>Unable to load account</Text>
          <Text style={{ color: "#991b1b", marginTop: 8, fontSize: 14 }}>{state.error}</Text>
        </View>
      ) : null}

      {state.customer ? (
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 20,
            gap: 12,
            shadowOpacity: 0.05,
            shadowRadius: 8,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{state.customer.displayName ?? "Account"}</Text>
          <Text style={{ fontSize: 16, color: "#4b5563" }}>{state.customer.emailAddress?.emailAddress ?? "—"}</Text>
          <Text style={{ fontSize: 15, color: "#4b5563" }}>{state.customer.phone?.phoneNumber ?? "No phone"}</Text>
          {state.customer.tags && state.customer.tags.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {state.customer.tags.map((tag) => (
                <View
                  key={tag}
                  style={{ backgroundColor: "#e5e7eb", borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151" }}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text
            onPress={onSignOut}
            accessibilityRole="button"
            style={{ color: "#2563eb", marginTop: 8, fontWeight: "600" }}
          >
            Sign out
          </Text>
        </View>
      ) : null}

      {state.customer?.defaultAddress ? (
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, gap: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>Default address</Text>
          {state.customer.defaultAddress.formatted?.map((line, idx) => (
            <Text key={`default-${idx}`} style={{ fontSize: 15, color: "#4b5563" }}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>Addresses</Text>
        {addresses.length === 0 ? (
          <Text style={{ color: "#6b7280" }}>No addresses saved.</Text>
        ) : (
          addresses.map((address) => (
            <View key={address.id} style={{ borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 12 }}>
              <Text style={{ fontWeight: "600", fontSize: 16 }}>
                {[address.firstName, address.lastName].filter(Boolean).join(" ") || "Unnamed"}
              </Text>
              {(address.formatted ?? []).map((line, idx) => (
                <Text key={`${address.id}-${idx}`} style={{ color: "#4b5563", marginTop: 2 }}>
                  {line}
                </Text>
              ))}
            </View>
          ))
        )}
      </View>

      <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>Recent orders</Text>
        {orders.length === 0 ? (
          <Text style={{ color: "#6b7280" }}>No orders yet.</Text>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={{ borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 12 }}>
              <Text style={{ fontWeight: "600", fontSize: 16 }}>{order.name ?? order.id}</Text>
              <Text style={{ color: "#4b5563", marginTop: 2 }}>
                {order.processedAt ? new Date(order.processedAt).toLocaleString() : "Processing"}
              </Text>
              <Text style={{ color: "#4b5563", marginTop: 2 }}>
                Status: {[order.financialStatus, order.fulfillmentStatus].filter(Boolean).join(" · ") || "Pending"}
              </Text>
              {order.totalPriceSet?.presentmentMoney ? (
                <Text style={{ color: "#1f2937", marginTop: 2 }}>
                  Total: {order.totalPriceSet.presentmentMoney.amount}{" "}
                  {order.totalPriceSet.presentmentMoney.currencyCode}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}
