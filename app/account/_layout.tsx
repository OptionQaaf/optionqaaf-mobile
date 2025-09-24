import { Stack } from "expo-router"

export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationDuration: 240,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="addresses" />
      <Stack.Screen name="address/[id]" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="sign-in" />
    </Stack>
  )
}
