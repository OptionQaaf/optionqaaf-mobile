import "@/assets/css/main.css"
import { isOnboardingDone } from "@/lib/storage/flags"
import { Redirect } from "expo-router"
import { useEffect, useState } from "react"

export default function Index() {
  const [checked, setChecked] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    isOnboardingDone().then((d) => {
      setDone(d)
      setChecked(true)
    })
  }, [])

  if (!checked) return null
  if (!done) return <Redirect href="/(onboarding)/locale" />
  return <Redirect href="/home" />
}
