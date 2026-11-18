import type { SaveBookmark } from '../types/bookmark'
import { normalizeBookmarkUrl } from './bookmarkUrl'
import { BOOKMARKS_KEY, CONNECTIONS_KEY, createBookmarkRepository } from './bookmarks'

export type ActivePage = Pick<SaveBookmark, 'title' | 'url'>

export async function getActivePage(): Promise<ActivePage | null> {
  if (!globalThis.chrome?.tabs) return null

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url && normalizeBookmarkUrl(tab.url)
  return url ? { title: tab.title?.trim() || new URL(url).hostname, url } : null
}

export function getBookmarkRepository() {
  const storage = globalThis.chrome?.storage?.local
  if (!storage) throw new Error('Chrome local storage is unavailable.')
  return createBookmarkRepository(storage, navigator.locks)
}

export function watchBookmarks(onChange: () => void) {
  const storage = globalThis.chrome?.storage?.local
  if (!storage) return

  const listener: Parameters<typeof storage.onChanged.addListener>[0] = (changes) => {
    if (BOOKMARKS_KEY in changes || CONNECTIONS_KEY in changes) onChange()
  }
  storage.onChanged.addListener(listener)
  return () => storage.onChanged.removeListener(listener)
}
