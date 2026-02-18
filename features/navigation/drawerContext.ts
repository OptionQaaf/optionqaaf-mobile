import { createContext, useContext } from "react"

export type DrawerCtx = { open: () => void; close: () => void; toggle: () => void; isOpen: boolean }

export const DrawerContext = createContext<DrawerCtx | null>(null)

export const useDrawer = () => {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error("useDrawer must be used within <DrawerProvider>")
  return ctx
}
