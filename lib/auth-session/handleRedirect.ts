import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"

type AuthRedirectParams = {
  code?: string
  state?: string
  error?: string
  errorDescription?: string
}

type Listener = (params: AuthRedirectParams) => void

const listeners = new Set<Listener>()
let initialChecked = false

WebBrowser.maybeCompleteAuthSession()

Linking.addEventListener("url", ({ url }) => {
  if (!url) return
  const parsed = parseAuthRedirect(url)
  if (!parsed) return
  notify(parsed)
})

async function ensureInitialCheck() {
  if (initialChecked) return
  initialChecked = true
  const initialUrl = await Linking.getInitialURL()
  if (!initialUrl) return
  const parsed = parseAuthRedirect(initialUrl)
  if (!parsed) return
  notify(parsed)
}

function notify(params: AuthRedirectParams) {
  listeners.forEach((listener) => listener(params))
}

export function parseAuthRedirect(url: string): AuthRedirectParams | null {
  if (!url) return null
  const parsed = Linking.parse(url)
  const finalPath = parsed.path || parsed.hostname
  if (!finalPath || !/callback$/i.test(finalPath)) return null
  const params: AuthRedirectParams = {}
  const qp = parsed.queryParams ?? {}
  if (typeof qp.code === "string") params.code = qp.code
  if (typeof qp.state === "string") params.state = qp.state
  if (typeof qp.error === "string") params.error = qp.error
  if (typeof qp.error_description === "string") params.errorDescription = qp.error_description
  return params
}

/**
 * Wait for the next Shopify auth redirect. Resolves with the parsed parameters when received.
 */
export async function waitForAuthRedirect(timeoutMs = 120_000): Promise<AuthRedirectParams> {
  await ensureInitialCheck()
  return new Promise<AuthRedirectParams>((resolve, reject) => {
    const onRedirect: Listener = (params) => {
      clearTimeout(timer)
      listeners.delete(onRedirect)
      resolve(params)
    }

    const timer = setTimeout(() => {
      listeners.delete(onRedirect)
      reject(new Error("Timed out waiting for auth redirect"))
    }, timeoutMs)

    listeners.add(onRedirect)
  })
}

export type { AuthRedirectParams }
