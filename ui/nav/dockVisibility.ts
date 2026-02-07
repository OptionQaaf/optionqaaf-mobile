const HIDDEN_PATHNAME_PATTERNS = [
  /^\/locale$/,
  /^\/sign-in$/,
  /^\/reset-onboarding$/,
  /^\/pdp-demo$/,
  /^\/playground$/,
  /^\/checkout/,
  /^\/auth/,
  /^\/products$/,
  /^\/products\/.+$/,
]

const HIDDEN_SEGMENT_KEYWORDS = new Set(["dev"])

export function shouldShowDock(pathname: string, segments: string[]) {
  if (!pathname) return false
  const normalized = pathname.split("?")[0]

  if (HIDDEN_PATHNAME_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false
  }

  if (segments.some((segment) => HIDDEN_SEGMENT_KEYWORDS.has(segment))) {
    return false
  }

  return true
}
