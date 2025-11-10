import { convertAmount } from "@/features/currency/rates"
import { usePrefs } from "@/store/prefs"
import { cn } from "@/ui/utils/cva"
import { Text, View } from "react-native"

export type PriceSize = "xs" | "sm" | "md" | "lg" | "xl"

type Props = {
  amount: number // base price (in currency prop)
  compareAt?: number // base compareAt (in currency prop)
  currency?: string // source currency of the amount (e.g. "USD")
  locale?: string // optional override, else auto from prefs
  size?: PriceSize
  className?: string
  amountClassName?: string
  compareAtClassName?: string
  discountClassName?: string
}

function formatCurrency(v: number, currency = "USD", locale = "en-US") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(v)
  } catch {
    return `${v.toFixed(2)} ${currency}`
  }
}

type SizePreset = {
  amount: string
  compare: string
  discount: string
  horizontalGap: number
  stackGap: number
  discountPadH: number
  discountPadV: number
}

const SIZE_PRESETS: Record<PriceSize, SizePreset> = {
  xs: {
    amount: "text-[12px]",
    compare: "text-[9px]",
    discount: "text-[10px]",
    horizontalGap: 6,
    stackGap: 2,
    discountPadH: 6,
    discountPadV: 2,
  },
  sm: {
    amount: "text-[14px]",
    compare: "text-[11px]",
    discount: "text-[11px]",
    horizontalGap: 8,
    stackGap: 2,
    discountPadH: 6,
    discountPadV: 2,
  },
  md: {
    amount: "text-[16px]",
    compare: "text-[12px]",
    discount: "text-[12px]",
    horizontalGap: 9,
    stackGap: 3,
    discountPadH: 8,
    discountPadV: 3,
  },
  lg: {
    amount: "text-[18px]",
    compare: "text-[13px]",
    discount: "text-[13px]",
    horizontalGap: 10,
    stackGap: 4,
    discountPadH: 9,
    discountPadV: 4,
  },
  xl: {
    amount: "text-[20px]",
    compare: "text-[14px]",
    discount: "text-[14px]",
    horizontalGap: 12,
    stackGap: 5,
    discountPadH: 10,
    discountPadV: 5,
  },
}

export function Price({
  amount,
  compareAt,
  currency = "USD",
  locale,
  size = "sm",
  className,
  amountClassName,
  compareAtClassName,
  discountClassName,
}: Props) {
  const { currency: prefCurrency, language, country } = usePrefs()
  const targetCurrency = (prefCurrency || currency || "USD").toUpperCase()
  const fmtLocale = locale ?? (language === "AR" ? "ar-SA" : `en-${country || "US"}`)

  const displayAmount = convertAmount(amount, currency, targetCurrency)
  const displayCompareAt =
    typeof compareAt === "number" ? convertAmount(compareAt, currency, targetCurrency) : undefined
  const isOnSale = typeof displayCompareAt === "number" && displayCompareAt > displayAmount
  const pct = isOnSale ? Math.round(((displayCompareAt! - displayAmount) / displayCompareAt!) * 100) : 0
  const preset = SIZE_PRESETS[size] ?? SIZE_PRESETS.sm

  return (
    <View className={className}>
      <View
        className="flex-row items-center"
        style={{ columnGap: preset.horizontalGap, gap: preset.horizontalGap }}
      >
        <View
          className="flex-1 min-w-0"
          style={{ rowGap: preset.stackGap, gap: preset.stackGap }}
        >
          {isOnSale ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              className={cn("text-muted line-through", preset.compare, compareAtClassName)}
            >
              {formatCurrency(displayCompareAt!, targetCurrency, fmtLocale)}
            </Text>
          ) : null}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.9}
            style={{ minWidth: 0 }}
            className={cn("text-primary font-geist-semibold", preset.amount, amountClassName)}
          >
            {formatCurrency(displayAmount, targetCurrency, fmtLocale)}
          </Text>
        </View>

        {isOnSale ? (
          <View
            className="rounded-full bg-brand/10"
            style={{
              paddingHorizontal: preset.discountPadH,
              paddingVertical: preset.discountPadV,
              flexShrink: 0,
            }}
          >
            <Text className={cn("text-brand font-geist-semibold", preset.discount, discountClassName)}>
              {`-${pct}%`}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
