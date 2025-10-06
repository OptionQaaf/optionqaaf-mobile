import { useCallback } from "react"
import { View } from "react-native"

import { useLogin } from "@/lib/shopify/customer/hooks"
import { useToast } from "@/ui/feedback/Toast"
import { LoginCard } from "@/ui/account/LoginCard"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"

export default function AccountLoginScreen() {
  const { mutateAsync, isPending } = useLogin()
  const { show } = useToast()

  const onLogin = useCallback(async () => {
    if (isPending) return
    try {
      await mutateAsync()
    } catch (error: any) {
      const message = error?.message || "Login failed"
      show({ title: message, type: "danger" })
    }
  }, [isPending, mutateAsync, show])

  return (
    <Screen>
      <MenuBar back />
      <View className="flex-1 px-5 pt-6">
        <LoginCard onLogin={onLogin} isLoading={isPending} />
      </View>
    </Screen>
  )
}
