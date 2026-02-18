import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import { createMaterialTopTabNavigator, type MaterialTopTabBarProps } from "@react-navigation/material-top-tabs"
import { BlurView } from "expo-blur"
import { withLayoutContext } from "expo-router"
import { DeviceEventEmitter, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const { Navigator } = createMaterialTopTabNavigator()
const Tabs = withLayoutContext(Navigator)
const ROOT_MENU_BAR_HEIGHT = 42

export default function HomeTabsLayout() {
  const insets = useSafeAreaInsets()
  const rootTopOffset = insets.top + ROOT_MENU_BAR_HEIGHT

  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <HomeTabsBar {...props} rootTopOffset={rootTopOffset} />}
      screenOptions={{
        swipeEnabled: true,
        sceneStyle: {
          paddingTop: rootTopOffset,
          backgroundColor: "#FFFFFF",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="for-you" options={{ title: "For You" }} />
    </Tabs>
  )
}

function HomeTabsBar({
  state,
  descriptors,
  navigation,
  rootTopOffset,
}: MaterialTopTabBarProps & { rootTopOffset: number }) {
  return (
    <View className="absolute left-0 right-0 z-50 bg-transparent" style={{ top: rootTopOffset }}>
      <View className="items-center px-4 pt-2">
        <BlurView
          tint="systemUltraThinMaterialDark"
          intensity={45}
          className="h-[40px] flex-row items-center justify-center rounded-full overflow-hidden"
          style={{
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.14,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {state.routes.map((route, index) => {
            const isFocused = state.index === index
            const descriptor = descriptors[route.key]
            const title = descriptor.options.title ?? route.name

            return (
              <PressableOverlay
                key={route.key}
                onPress={() => {
                  if (isFocused) {
                    if (route.name === "for-you") {
                      DeviceEventEmitter.emit("fyp:tabReselect")
                    }
                    return
                  }
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  })
                  if (event.defaultPrevented) return
                  navigation.navigate(route.name, route.params)
                }}
                accessibilityLabel={typeof title === "string" ? title : undefined}
                className="items-center justify-center px-1"
              >
                <View
                  className={`h-[32px] min-w-[76px] items-center justify-center rounded-full px-3 ${
                    isFocused ? "bg-white/75" : ""
                  }`}
                  style={
                    isFocused
                      ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.08,
                          shadowRadius: 4,
                        }
                      : undefined
                  }
                >
                  <Text
                    className={`text-[13px] ${isFocused ? "font-bold text-slate-900" : "font-semibold text-white"}`}
                  >
                    {title}
                  </Text>
                </View>
              </PressableOverlay>
            )
          })}
        </BlurView>
      </View>
    </View>
  )
}
