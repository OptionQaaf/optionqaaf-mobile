import { Text, View } from "react-native"

type Props = {
  amount: number // e.g. 48 or 48.5 (major units)
  compareAt?: number // if higher than amount -> strike-through
  currency?: string // e.g. "USD", "EUR", "SAR"
  locale?: string // e.g. "en-US", "ar-SA"
  className?: string
}

function formatCurrency(v: number, currency = "USD", locale = "en-US") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(v)
  } catch {
    return `${v.toFixed(2)} ${currency}`
  }
}

export function Price({ amount, compareAt, currency = "USD", locale = "en-US", className }: Props) {
  const isOnSale = compareAt && compareAt > amount
  const pct = isOnSale ? Math.round(((compareAt! - amount) / compareAt!) * 100) : 0

  return (
    <View className={className}>
      <View className="flex-row items-baseline gap-2">
        <Text className="text-primary font-geist-semibold text-[14px]">{formatCurrency(amount, currency, locale)}</Text>

        {isOnSale ? (
          <>
            <Text className="text-muted line-through">{formatCurrency(compareAt!, currency, locale)}</Text>
            <Text className="text-brand font-geist-medium">{`-${pct}%`}</Text>
          </>
        ) : null}
      </View>
    </View>
  )
}
