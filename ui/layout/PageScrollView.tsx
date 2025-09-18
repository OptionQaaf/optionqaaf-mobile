import { AppFooter, type AppFooterProps } from "@/ui/layout/AppFooter"
import { cn } from "@/ui/utils/cva"
import { forwardRef, type ComponentType, type ReactNode } from "react"
import { ScrollView, type ScrollViewProps, View } from "react-native"
import { defaultKeyboardShouldPersistTaps, verticalScrollProps } from "./scrollDefaults"

type FooterComponent = ComponentType<AppFooterProps>

type Props = ScrollViewProps & {
  children: ReactNode
  contentContainerClassName?: string
  FooterComponent?: FooterComponent
  footerClassName?: string
  footerProps?: Partial<AppFooterProps>
}

export const PageScrollView = forwardRef<ScrollView, Props>(function PageScrollView(
  {
    children,
    contentContainerStyle,
    contentContainerClassName,
    keyboardShouldPersistTaps,
    FooterComponent = AppFooter,
    footerClassName,
    footerProps,
    ...rest
  },
  ref,
) {
  return (
    <ScrollView
      ref={ref}
      {...verticalScrollProps}
      {...rest}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? defaultKeyboardShouldPersistTaps}
      contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
      contentContainerClassName={cn(contentContainerClassName)}
      showsVerticalScrollIndicator={rest.showsVerticalScrollIndicator ?? false}
    >
      <View className="flex-1">
        {children}
      </View>
      <FooterComponent className={footerClassName} {...footerProps} />
    </ScrollView>
  )
})
