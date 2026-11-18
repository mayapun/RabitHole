export function normalizeBookmarkUrl(value: string): string | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
    return null
  }

  // Keep query order and nonempty fragments because both can affect the destination.
  if (url.search === '') url.search = ''
  if (url.hash === '') url.hash = ''
  return url.href
}
