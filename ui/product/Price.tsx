import { Text, View } from "react-native"
import { cn } from "@/ui/utils/cva"
import { usePrefs } from "@/store/prefs"
import { convertAmount } from "@/features/currency/rates"

type Props = {
  amount: number // base price (in currency prop)
  compareAt?: number // base compareAt (in currency prop)
  currency?: string // source currency of the amount (e.g. "USD")
  locale?: string // optional override, else auto from prefs
  className?: string
  amountClassName?: string
}

function formatCurrency(v: number, currency = "USD", locale = "en-US") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(v)
  } catch {
    return `${v.toFixed(2)} ${currency}`
  }
}

export function Price({ amount, compareAt, currency = "USD", locale, className, amountClassName }: Props) {
  const { currency: prefCurrency, language, country } = usePrefs()
  const targetCurrency = (prefCurrency || currency || "USD").toUpperCase()
  const fmtLocale = locale ?? (language === "AR" ? "ar-SA" : `en-${country || "US"}`)

  const displayAmount = convertAmount(amount, currency, targetCurrency)
  const displayCompareAt =
    typeof compareAt === "number" ? convertAmount(compareAt, currency, targetCurrency) : undefined
  const isOnSale = typeof displayCompareAt === "number" && displayCompareAt > displayAmount
  const pct = isOnSale ? Math.round(((displayCompareAt! - displayAmount) / displayCompareAt!) * 100) : 0

  return (
    <View className={className}>
      <View className="flex-row items-baseline justify-between">
        {/* Left: single Text that auto-scales to fit, keeping price + compareAt on one line */}
        <View className="flex-1 min-w-0">
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9} style={{ minWidth: 0 }}>
            <Text className={cn("text-primary font-geist-semibold text-[16px]", amountClassName)}>
              {formatCurrency(displayAmount, targetCurrency, fmtLocale)}
            </Text>
            {isOnSale ? (
              <Text className="text-muted line-through text-[12px]">{` ${formatCurrency(
                displayCompareAt!,
                targetCurrency,
                fmtLocale,
              )}`}</Text>
            ) : null}
          </Text>
        </View>

        {/* Right: discount percentage stays separate */}
        {isOnSale ? <Text className="text-brand font-geist-medium ml-2 text-[12px]">{`-${pct}%`}</Text> : null}
      </View>
    </View>
  )
}
