import { signOutCustomer, useCustomerOverview } from "@/features/account/api"
import { useCustomerSession } from "@/features/account/session"
import { formatMoney } from "@/lib/shopify/money"
import type { AddressNode, OrderEdge } from "@/lib/shopify/types/customer"
import { useToast } from "@/ui/feedback/Toast"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { PageScrollView } from "@/ui/layout/PageScrollView"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"
import { Badge } from "@/ui/primitives/Badge"
import { Button } from "@/ui/primitives/Button"
import { H2, Muted, Text } from "@/ui/primitives/Typography"
import { Image } from "expo-image"
import { router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { ChevronRight, CreditCard, Edit3, LogOut, MapPin, PlusCircle, User2 } from "lucide-react-native"
import { useMemo, useState } from "react"
import { ActivityIndicator, Linking, View } from "react-native"

function formatDate(value?: string | null) {
  if (!value) return ""
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function resolveStatusVariant(status?: string | null) {
  switch (status) {
    case "FULFILLED":
      return { label: "Delivered", variant: "success" as const }
    case "IN_PROGRESS":
    case "PARTIALLY_FULFILLED":
    case "SCHEDULED":
      return { label: "In progress", variant: "brand" as const }
    case "ON_HOLD":
    case "OPEN":
    case "UNFULFILLED":
      return { label: "Pending", variant: "outline" as const }
    case "CANCELED":
      return { label: "Canceled", variant: "danger" as const }
    default:
      return { label: status ? status.replace(/_/g, " ") : "Pending", variant: "outline" as const }
  }
}

export default function AccountHome() {
  const isAuthenticated = !!useCustomerSession((s) => s.accessToken)
  const toast = useToast()
  const { data, isLoading, refetch, isRefetching, error } = useCustomerOverview({ enabled: isAuthenticated })
  const [loggingOut, setLoggingOut] = useState(false)

  const orders = useMemo(
    () => (data?.customer?.orders?.edges as OrderEdge[] | undefined) ?? [],
    [data?.customer?.orders?.edges],
  )
  const addresses = useMemo(
    () => (data?.customer?.addresses?.nodes as AddressNode[] | undefined) ?? [],
    [data?.customer?.addresses?.nodes],
  )
  const defaultAddressId = data?.customer?.defaultAddress?.id
  const accountPortal = data?.shop?.customerAccountUrl

  const handleSignIn = () => router.push("/account/sign-in")

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      await signOutCustomer({ revoke: true })
      toast.show({ title: "Signed out", type: "success" })
    } catch (err: any) {
      const message = err?.message || "Couldn’t complete sign out"
      toast.show({ title: message, type: "danger" })
    } finally {
      setLoggingOut(false)
    }
  }

  const openSavedCards = async () => {
    if (!accountPortal) {
      toast.show({ title: "Saved cards are not available yet." })
      return
    }
    try {
      const url = `${accountPortal.replace(/\/$/, "")}/wallet`
      await Linking.openURL(url)
    } catch {
      toast.show({ title: "Couldn’t open saved cards", type: "danger" })
    }
  }

  const showAddresses = () => router.push("/account/addresses" as const)
  const showProfile = () => router.push("/account/profile" as const)

  return (
    <Screen>
      <StatusBar style="dark" />
      <MenuBar variant="light" />
      <PageScrollView contentContainerClassName="pb-8" isFooterHidden>
        <View className="px-5 pt-6 pb-12 gap-6">
          <View className="gap-4">
            <H2 className="font-geist-bold">Account</H2>
            <Muted className="text-[15px]">
              {isAuthenticated
                ? "Manage your OptionQaaf profile, addresses, and recent orders."
                : "Sign in securely with Shopify to manage your orders and account details."}
            </Muted>
          </View>

          {!isAuthenticated ? (
            <View className="rounded-3xl bg-[#F7F7F7] px-5 py-8 items-center gap-5">
              <View className="h-20 w-20 rounded-full bg-white items-center justify-center">
                <User2 size={36} color="#1F1F1F" />
              </View>
              <View className="items-center gap-2">
                <Text className="text-[20px] font-geist-semibold">Welcome back</Text>
                <Muted className="text-center text-[15px]">
                  Access your saved information, track orders, and manage your preferences.
                </Muted>
              </View>
              <Button onPress={handleSignIn} className="px-6">
                Sign in with Shopify
              </Button>
            </View>
          ) : (
            <>
              <ProfileCard
                name={
                  data?.customer?.displayName ||
                  `${data?.customer?.firstName ?? ""} ${data?.customer?.lastName ?? ""}`.trim()
                }
                email={data?.customer?.email ?? undefined}
                phone={data?.customer?.phone ?? undefined}
                onEdit={showProfile}
                loading={isLoading || isRefetching}
              />

              <View className="rounded-3xl bg-[#FBFBFB] border border-[#F0F0F0] p-5 gap-4">
                <Text className="text-[18px] font-geist-semibold">Account shortcuts</Text>

                <ShortcutRow
                  icon={<MapPin size={20} color="#0B0B0B" />}
                  label="Saved Addresses"
                  onPress={showAddresses}
                />
                <ShortcutRow
                  icon={<CreditCard size={20} color="#0B0B0B" />}
                  label="Saved Cards"
                  onPress={openSavedCards}
                />
                <ShortcutRow
                  icon={<Edit3 size={20} color="#0B0B0B" />}
                  label="Edit Account Info"
                  onPress={showProfile}
                />
              </View>

              <OrdersSection
                orders={orders}
                loading={isLoading || isRefetching}
                onRefresh={() => {
                  refetch()
                }}
                error={error instanceof Error ? error : null}
              />

              <Button
                variant="outline"
                onPress={handleLogout}
                isLoading={loggingOut}
                leftIcon={<LogOut size={18} color="#0B0B0B" />}
                fullWidth
              >
                Sign out
              </Button>
            </>
          )}
        </View>
      </PageScrollView>
    </Screen>
  )
}

type ProfileCardProps = {
  name?: string
  email?: string
  phone?: string
  onEdit: () => void
  loading?: boolean
}

function ProfileCard({ name, email, phone, onEdit, loading }: ProfileCardProps) {
  return (
    <View className="rounded-3xl border border-[#F0F0F0] bg-white px-5 py-6 flex-row items-center gap-5">
      <View className="h-16 w-16 rounded-full bg-[#EFEFEF] items-center justify-center">
        <User2 size={28} color="#0B0B0B" />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-[18px] font-geist-semibold" numberOfLines={1}>
          {name || "Your account"}
        </Text>
        {!!email && (
          <Muted numberOfLines={1} className="text-[15px]">
            {email}
          </Muted>
        )}
        {!!phone && (
          <Muted numberOfLines={1} className="text-[15px]">
            {phone}
          </Muted>
        )}
      </View>
      <PressableOverlay onPress={onEdit} className="rounded-2xl bg-black px-4 py-2">
        <Text className="text-white font-geist-medium">Edit</Text>
      </PressableOverlay>
      {loading ? <ActivityIndicator /> : null}
    </View>
  )
}

type ShortcutRowProps = {
  icon: React.ReactNode
  label: string
  onPress: () => void
  trailingIcon?: React.ReactNode
}

function ShortcutRow({ icon, label, onPress, trailingIcon }: ShortcutRowProps) {
  return (
    <PressableOverlay
      onPress={onPress}
      className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 rounded-2xl bg-[#F2F2F2] items-center justify-center">{icon}</View>
        <Text className="text-[16px] font-geist-medium">{label}</Text>
      </View>
      {trailingIcon ?? <ChevronRight size={18} color="#0B0B0B" />}
    </PressableOverlay>
  )
}

type AddressesPreviewProps = {
  addresses: AddressNode[]
  defaultAddressId?: string | null
  onPressManage: () => void
}

function AddressesPreview({ addresses, defaultAddressId, onPressManage }: AddressesPreviewProps) {
  if (!addresses?.length) {
    return (
      <View className="rounded-3xl border border-dashed border-[#E5E5E5] bg-[#FCFCFC] p-5 items-center gap-3">
        <Text className="text-[17px] font-geist-semibold">No saved addresses</Text>
        <Muted className="text-center text-[15px]">Save your shipping details to speed up checkout.</Muted>
        <Button onPress={onPressManage} variant="outline" leftIcon={<PlusCircle size={18} color="#0B0B0B" />}>
          Add address
        </Button>
      </View>
    )
  }

  const primary = addresses.find((a: any) => a?.id === defaultAddressId) ?? addresses[0]
  const other = addresses.filter((a: any) => a?.id !== primary?.id)

  return (
    <View className="rounded-3xl border border-[#F0F0F0] bg-white p-5 gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[18px] font-geist-semibold">Addresses</Text>
        <PressableOverlay onPress={onPressManage} className="px-3 py-1 rounded-xl bg-[#F5F5F5]">
          <Text className="text-[14px] font-geist-medium">Manage</Text>
        </PressableOverlay>
      </View>

      <AddressCard address={primary as AddressNode} highlight />
      {other.slice(0, 1).map((addr: any) => (
        <AddressCard key={addr?.id} address={addr} />
      ))}
      {other.length > 1 ? <Muted className="text-[14px]">+{other.length - 1} more saved addresses</Muted> : null}
    </View>
  )
}

type AddressCardProps = {
  address: AddressNode | undefined
  highlight?: boolean
}

function AddressCard({ address, highlight }: AddressCardProps) {
  if (!address) return null
  return (
    <View
      className={`rounded-2xl px-4 py-4 border ${highlight ? "border-brand/40 bg-brand/5" : "border-[#EFEFEF] bg-[#FBFBFB]"}`}
    >
      <View className="flex-row items-center gap-2 mb-2">
        <MapPin size={16} color="#0B0B0B" />
        <Text className="text-[15px] font-geist-semibold">
          {address.firstName} {address.lastName}
        </Text>
      </View>
      {address.formatted?.map((line: any, idx: number) => (
        <Muted key={idx} className="text-[14px]">
          {line}
        </Muted>
      ))}
      {address.phone ? <Muted className="text-[14px] mt-2">{address.phone}</Muted> : null}
    </View>
  )
}

type OrdersSectionProps = {
  orders: OrderEdge[]
  loading: boolean
  onRefresh: () => void
  error: Error | null
}

function OrdersSection({ orders, loading, onRefresh, error }: OrdersSectionProps) {
  return (
    <View className="rounded-3xl border border-[#F0F0F0] bg-white p-5 gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[18px] font-geist-semibold">My Orders</Text>
        <PressableOverlay onPress={onRefresh} className="px-3 py-1 rounded-xl bg-[#F5F5F5]">
          {loading ? <ActivityIndicator size="small" color="#0B0B0B" /> : <Text className="text-[14px]">Refresh</Text>}
        </PressableOverlay>
      </View>

      {error ? (
        <Muted className="text-danger text-[14px]">{error.message}</Muted>
      ) : orders.length === 0 ? (
        <Muted className="text-[14px]">No orders yet. Your purchases will appear here.</Muted>
      ) : (
        orders.slice(0, 5).map((edge: any) => <OrderCard key={edge?.node?.id || edge?.cursor} order={edge?.node} />)
      )}
    </View>
  )
}

type OrderCardProps = {
  order: any
}

function OrderCard({ order }: OrderCardProps) {
  if (!order) return null
  const status = resolveStatusVariant(order.fulfillmentStatus)
  const total = formatMoney(order.currentTotalPrice)
  const date = formatDate(order.processedAt)

  const previewItems = order?.lineItems?.nodes ?? []

  const openStatus = async () => {
    if (!order.statusUrl) return
    try {
      await Linking.openURL(order.statusUrl)
    } catch {
      // ignore
    }
  }

  return (
    <View className="rounded-3xl border border-[#F0F0F0] bg-[#FCFCFC] p-4 gap-4">
      <View className="flex-row items-center justify-between">
        <View className="gap-1">
          <Text className="text-[15px] font-geist-semibold">Order #{order.orderNumber}</Text>
          <Muted className="text-[13px]">{date}</Muted>
        </View>
        <Badge variant={status.variant} className="h-7 px-3">
          {status.label}
        </Badge>
      </View>

      <View className="flex-row gap-3">
        {previewItems.slice(0, 3).map((item: any) => (
          <View key={item?.id} className="h-16 w-16 rounded-2xl bg-white border border-[#F0F0F0] overflow-hidden">
            {item?.variant?.image?.url ? (
              <Image source={item.variant.image.url} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View className="flex-1 items-center justify-center bg-[#F5F5F5]">
                <Muted className="text-[12px]">x{item?.quantity}</Muted>
              </View>
            )}
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-[17px] font-geist-semibold">{total}</Text>
        <PressableOverlay onPress={openStatus} className="flex-row items-center gap-2 px-3 py-1 rounded-xl bg-black">
          <Text className="text-white text-[14px]">Track order</Text>
        </PressableOverlay>
      </View>
    </View>
  )
}
