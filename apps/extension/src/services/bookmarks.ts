import type { Bookmark, BookmarkConnection, BookmarkGraph, SaveBookmark, SaveResult } from '../types/bookmark'
import { normalizeBookmarkUrl } from './bookmarkUrl'

export const BOOKMARKS_KEY = 'bookmarks'
export const CONNECTIONS_KEY = 'connections'
const WRITE_LOCK = 'rabbithole:bookmarks'

interface BookmarkStorage {
  get(keys: string | string[]): Promise<Partial<BookmarkGraph>>
  set(items: Partial<BookmarkGraph>): Promise<void>
}

interface BookmarkLocks {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>
}

export function createBookmarkRepository(storage: BookmarkStorage, locks: BookmarkLocks) {
  async function list(): Promise<Bookmark[]> {
    const { bookmarks } = await storage.get(BOOKMARKS_KEY)
    return bookmarks ?? []
  }

  async function readGraph(): Promise<BookmarkGraph> {
    const { bookmarks = [], connections = [] } = await storage.get([BOOKMARKS_KEY, CONNECTIONS_KEY])
    return { bookmarks, connections }
  }

  async function save(input: SaveBookmark): Promise<SaveResult> {
    const url = normalizeBookmarkUrl(input.url)
    if (!url) throw new Error('Expected an HTTP or HTTPS page URL.')

    return locks.request(WRITE_LOCK, async () => {
      const bookmarks = await list()
      const duplicate = bookmarks.find((bookmark) => normalizeBookmarkUrl(bookmark.url) === url)
      if (duplicate) return { status: 'duplicate', bookmark: duplicate } as const

      const bookmark: Bookmark = {
        id: crypto.randomUUID(),
        title: input.title.trim() || new URL(url).hostname,
        url,
        notes: input.notes.trim(),
        createdAt: new Date().toISOString(),
      }
      await storage.set({ [BOOKMARKS_KEY]: [bookmark, ...bookmarks] })
      return { status: 'saved', bookmark } as const
    })
  }

  async function remove(id: string): Promise<void> {
    await locks.request(WRITE_LOCK, async () => {
      const { bookmarks, connections } = await readGraph()
      const remaining = bookmarks.filter((bookmark) => bookmark.id !== id)
      if (remaining.length !== bookmarks.length) {
        await storage.set({
          bookmarks: remaining,
          connections: connections.filter((connection) => !connection.includes(id)),
        })
      }
    })
  }

  async function connect(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) throw new Error('Select two different bookmarks.')

    await locks.request(WRITE_LOCK, async () => {
      const { bookmarks, connections } = await readGraph()
      if (![sourceId, targetId].every((id) => bookmarks.some((bookmark) => bookmark.id === id))) {
        throw new Error('Both bookmarks must still be saved.')
      }

      const [first, second] = connectionPair(sourceId, targetId)
      if (!connections.some(([a, b]) => a === first && b === second)) {
        await storage.set({ connections: [...connections, [first, second]] })
      }
    })
  }

  async function disconnect(sourceId: string, targetId: string): Promise<void> {
    await locks.request(WRITE_LOCK, async () => {
      const { connections } = await readGraph()
      const [first, second] = connectionPair(sourceId, targetId)
      const remaining = connections.filter(([a, b]) => a !== first || b !== second)
      if (remaining.length !== connections.length) await storage.set({ connections: remaining })
    })
  }

  return { list, readGraph, save, remove, connect, disconnect }
}

function connectionPair(sourceId: string, targetId: string): BookmarkConnection {
  return sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId]
}
