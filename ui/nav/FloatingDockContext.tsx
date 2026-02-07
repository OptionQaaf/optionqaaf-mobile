import { type PropsWithChildren, createContext, useContext, useMemo, useState } from "react"

type FloatingDockScaleContextValue = {
  scale: number
  setScale: (value: number) => void
}

const FloatingDockScaleContext = createContext<FloatingDockScaleContextValue | undefined>(undefined)

export function FloatingDockScaleProvider({ children }: PropsWithChildren<{}>) {
  const [scale, setScale] = useState(1)
  const value = useMemo(
    () => ({
      scale,
      setScale,
    }),
    [scale],
  )

  return <FloatingDockScaleContext.Provider value={value}>{children}</FloatingDockScaleContext.Provider>
}

export function useFloatingDockScaleContext() {
  return useContext(FloatingDockScaleContext)
}
