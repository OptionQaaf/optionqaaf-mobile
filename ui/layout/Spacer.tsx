import { View } from "react-native"
export function Spacer({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />
}
