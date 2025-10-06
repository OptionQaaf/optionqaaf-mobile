import { Button } from "@/ui/primitives/Button"
import { H2, Muted, Text } from "@/ui/primitives/Typography"
import { Card } from "@/ui/surfaces/Card"
import { View } from "react-native"

type Props = {
  onLogin: () => void
  isLoading?: boolean
}

export function LoginCard({ onLogin, isLoading }: Props) {
  return (
    <Card padding="lg" className="gap-4 bg-surface">
      <View className="gap-3">
        <H2 className="text-[22px] leading-[28px]">Sign in to OptionQaaf</H2>
        <Text className="text-[16px] text-secondary">
          Access your customer profile, saved addresses, and order history. You’ll stay signed in for faster checkout.
        </Text>
      </View>
      <Muted className="text-[14px]">You’ll be redirected to Shopify to complete a secure login.</Muted>
      <Button
        onPress={onLogin}
        isLoading={isLoading}
        disabled={isLoading}
        accessibilityLabel="Log in with Shopify Customer Account"
        fullWidth
      >
        Log in with Shopify
      </Button>
    </Card>
  )
}
