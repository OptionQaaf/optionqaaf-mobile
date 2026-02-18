import { SignInPrompt } from "@/features/auth/AuthGate"
import { Screen } from "@/ui/layout/Screen"
import { Image } from "expo-image"
import { View } from "react-native"

type Props = {
  onSuccess: () => void
}

export function AccountSignInFallback({ onSuccess }: Props) {
  return (
    <Screen bleedTop bleedBottom>
      <View className="flex-1 bg-[#f8fafc]">
        <Image
          source={require("@/assets/images/hero-blur.png")}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 240, opacity: 0.25 }}
          contentFit="cover"
        />
        <View className="flex-1">
          <SignInPrompt
            title="Sign in to your account"
            description="Unlock your orders, wishlist, and saved checkout details in one place."
            buttonLabel="Sign in"
            onSuccess={onSuccess}
            bleedTopImage
            showBackgroundImage={false}
          />
        </View>
      </View>
    </Screen>
  )
}
