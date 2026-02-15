import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { MenuBar } from "@/ui/nav/MenuBar"
import { createMaterialTopTabNavigator, type MaterialTopTabBarProps } from "@react-navigation/material-top-tabs"
import { withLayoutContext } from "expo-router"
import { Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const { Navigator } = createMaterialTopTabNavigator()
const Tabs = withLayoutContext(Navigator)
const MENU_BAR_HEIGHT = 42

export default function HomeTabsLayout() {
  const insets = useSafeAreaInsets()
  const sceneTopOffset = insets.top + MENU_BAR_HEIGHT

  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <HomeTabsBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        sceneStyle: {
          paddingTop: sceneTopOffset,
          backgroundColor: "#FFFFFF",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="for-you" options={{ title: "For You" }} />
    </Tabs>
  )
}

function HomeTabsBar({ state, descriptors, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View className="absolute left-0 right-0 top-0 z-50 bg-transparent" style={{ paddingTop: insets.top }}>
      <MenuBar />
      <View className="px-4 pb-[10px] pt-2">
        <View className="flex-row justify-center align-middle gap-4">
          {state.routes.map((route, index) => {
            const isFocused = state.index === index
            const descriptor = descriptors[route.key]
            const title = descriptor.options.title ?? route.name

            return (
              <PressableOverlay
                key={route.key}
                onPress={() => {
                  if (isFocused) return
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  })
                  if (event.defaultPrevented) return
                  navigation.navigate(route.name, route.params)
                }}
                accessibilityLabel={typeof title === "string" ? title : undefined}
                className="rounded-md px-1 py-1"
              >
                <Text
                  className={`text-[14px] ${isFocused ? "font-bold text-slate-900" : "font-semibold text-slate-500"}`}
                >
                  {title}
                </Text>
              </PressableOverlay>
            )
          })}
        </View>
      </View>
    </View>
  )
}
