import { useCallback, useEffect, useRef, useState } from 'react'
import { getBookmarkRepository, watchBookmarks } from '../services/browser'
import type { BookmarkGraph } from '../types/bookmark'

type LibraryState =
  | { status: 'loading' }
  | { status: 'ready'; graph: BookmarkGraph }
  | { status: 'error' }

export function useBookmarks() {
  const [library, setLibrary] = useState<LibraryState>({ status: 'loading' })
  const requests = useRef({ latest: 0 })

  const refresh = useCallback(() => {
    const tracker = requests.current
    const request = ++tracker.latest
    return Promise.resolve().then(() => getBookmarkRepository().readGraph()).then(
      (graph) => {
        if (request === tracker.latest) setLibrary({ status: 'ready', graph })
      },
      () => {
        if (request === tracker.latest) setLibrary({ status: 'error' })
      },
    )
  }, [])

  useEffect(() => {
    const tracker = requests.current
    const unsubscribe = watchBookmarks(() => void refresh())
    void refresh()
    return () => {
      ++tracker.latest
      unsubscribe?.()
    }
  }, [refresh])

  return { library, refresh }
}
