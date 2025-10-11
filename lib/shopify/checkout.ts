export function withLoggedInParam(url: string): string {
  if (!url) return url
  return url.includes("?") ? `${url}&logged_in=true` : `${url}?logged_in=true`
}
