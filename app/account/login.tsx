import { useCallback } from "react"
import { View } from "react-native"

import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/ui/feedback/Toast"
import { LoginCard } from "@/ui/account/LoginCard"
import { Screen } from "@/ui/layout/Screen"
import { MenuBar } from "@/ui/nav/MenuBar"

export default function AccountLoginScreen() {
  const { loginWithOTP, isFetchingCustomer } = useAuth()
  const { show } = useToast()

  const onLogin = useCallback(async () => {
    if (isFetchingCustomer) return
    try {
      await loginWithOTP()
    } catch (error: any) {
      const message = error?.message || "Login failed"
      show({ title: message, type: "danger" })
    }
  }, [isFetchingCustomer, loginWithOTP, show])

  return (
    <Screen>
      <MenuBar back />
      <View className="flex-1 px-5 pt-6">
        <LoginCard onLogin={onLogin} isLoading={isFetchingCustomer} />
      </View>
    </Screen>
  )
}
