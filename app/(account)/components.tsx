import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { cn } from "@/ui/utils/cva"
import { ChevronRight } from "lucide-react-native"
import { Image } from "expo-image"
import { ReactNode } from "react"
import { View } from "react-native"
import { type MeOrdersQuery } from "@/lib/shopify/customer/gql/graphql"

export type AccountPerson = {
  name?: string | null
  email?: string | null
  phone?: string | null
  subtitle?: string | null
  imageUrl?: string | null
}

export function AccountSummaryCard({
  person,
  action,
  footer,
  className,
}: {
  person: AccountPerson
  action?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const { name, email, phone, subtitle, imageUrl } = person

  return (
    <Card padding="lg" className={cn("gap-5 bg-white", className)}>
      <View className="flex-row items-center gap-4">
        <AccountAvatar imageUrl={imageUrl} name={name} />
        <View className="flex-1 gap-1">
          {subtitle ? <Muted className="text-[13px] uppercase tracking-wide">{subtitle}</Muted> : null}
          <Text className="text-[20px] font-geist-semibold" numberOfLines={1}>
            {name || "Account"}
          </Text>
          {email ? (
            <Muted className="text-[15px]" numberOfLines={1}>
              {email}
            </Muted>
          ) : null}
          {phone ? (
            <Muted className="text-[15px]" numberOfLines={1}>
              {phone}
            </Muted>
          ) : null}
        </View>
        {action ? <View className="self-start">{action}</View> : null}
      </View>
      {footer ? (
        <View className="gap-4">
          <View className="h-px bg-border/60" />
          {footer}
        </View>
      ) : null}
    </Card>
  )
}

export function AccountList({ children }: { children: ReactNode }) {
  return (
    <Card padding="none" className="overflow-hidden bg-white">
      <View className="divide-y divide-border">{children}</View>
    </Card>
  )
}

export function AccountListItem({
  title,
  description,
  onPress,
  trailing,
}: {
  title: string
  description?: string
  onPress?: () => void
  trailing?: ReactNode
}) {
  return (
    <PressableOverlay onPress={onPress} disabled={!onPress}>
      <View className="flex-row items-center justify-between px-5 py-4 bg-white">
        <View className="flex-1 pr-4">
          <Text className="text-[16px] font-geist-medium">{title}</Text>
          {description ? (
            <Muted className="mt-1 text-[14px]" numberOfLines={2}>
              {description}
            </Muted>
          ) : null}
        </View>
        {trailing ?? <ChevronRight size={20} color="#0B0B0B" />}
      </View>
    </PressableOverlay>
  )
}

export function AccountSectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <View className="gap-1">
      <Text className="text-[18px] font-geist-semibold">{title}</Text>
      {description ? <Muted className="text-[14px]">{description}</Muted> : null}
    </View>
  )
}

export function AccountAvatar({
  imageUrl,
  name,
  size = 68,
}: {
  imageUrl?: string | null
  name?: string | null
  size?: number
}) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    )
  }

  const letter = typeof name === "string" && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : "?"

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-neutral-200 items-center justify-center"
    >
      <Text className="text-[24px] font-geist-semibold text-primary">{letter}</Text>
    </View>
  )
}

export function AccountInfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="gap-1">
      <Muted className="text-[12px] uppercase tracking-wide">{label}</Muted>
      <Text className="text-[15px]">{value || "—"}</Text>
    </View>
  )
}

type OrderNode = MeOrdersQuery["customer"]["orders"]["nodes"][number]

export function OrderPreviewCard({ order }: { order: OrderNode }) {
  const createdAt = formatDate(order?.createdAt)
  const price = formatPrice(order?.totalPrice?.amount, order?.currencyCode)

  return (
    <View className="flex-row items-center gap-4 rounded-2xl border border-border px-4 py-4 bg-[#FFF5F5]">
      <View className="flex-row gap-2">
        <PlaceholderTile />
        <PlaceholderTile />
        <PlaceholderTile />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-[15px] font-geist-semibold">{order?.name ?? "Order"}</Text>
        <Muted className="text-[13px]">{createdAt}</Muted>
      </View>
      <View className="items-end gap-1">
        <Text className="text-[18px] font-geist-semibold text-[#E11D48]">{price}</Text>
        <Badge text={order?.processedAt ? "Delivered" : "Processing"} />
      </View>
    </View>
  )
}

function PlaceholderTile() {
  return <View className="w-12 h-12 rounded-xl bg-white/80 border border-white/70" />
}

function Badge({ text }: { text: string }) {
  return (
    <View className="px-3 py-1 rounded-full bg-white border border-white/70">
      <Muted className="text-[12px] font-geist-medium text-[#E11D48]">{text}</Muted>
    </View>
  )
}

export function formatFullName(
  profile: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null,
) {
  if (!profile) return null
  if (profile.displayName) return profile.displayName
  const parts = [profile.firstName, profile.lastName].filter(Boolean)
  return parts.length ? parts.join(" ") : null
}

export function formatDate(value?: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value ?? "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function formatPrice(amount?: string | null, currency?: string | null) {
  if (!amount) return "—"
  const parsed = Number(amount)
  if (!Number.isFinite(parsed)) return `${amount} ${currency ?? ""}`.trim()
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "USD" }).format(parsed)
  } catch {
    return `${parsed.toFixed(2)} ${currency ?? ""}`.trim()
  }
}

export function formatCreationDate(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}
