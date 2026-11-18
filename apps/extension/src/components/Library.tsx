import { useRef, useState } from 'react'
import { normalizeBookmarkUrl } from '../services/bookmarkUrl'
import { getBookmarkRepository } from '../services/browser'
import type { Bookmark } from '../types/bookmark'

interface LibraryProps {
  bookmarks: Bookmark[] | undefined
  loading: boolean
  onCapture: () => void
  onGraph: (id: string) => void
  refresh: () => Promise<void>
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export function Library({ bookmarks, loading, onCapture, onGraph, refresh }: LibraryProps) {
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const deleting = useRef(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const query = search.toLowerCase().trim()
  const results = bookmarks?.filter(({ title, url, notes }) =>
    [title, url, notes].some((value) => value.toLowerCase().includes(query)),
  )

  async function deleteBookmark(bookmark: Bookmark) {
    if (deleting.current) return
    deleting.current = true
    setPending(bookmark.id)
    setNotice(null)
    try {
      await getBookmarkRepository().remove(bookmark.id)
      searchInput.current?.focus()
      await refresh()
      setNotice({ kind: 'success', text: 'Bookmark deleted.' })
    } catch {
      setNotice({ kind: 'error', text: `Couldn’t delete “${bookmark.title}”. Try again.` })
    } finally {
      deleting.current = false
      setPending(null)
    }
  }

  return (
    <section className="view" aria-labelledby="library-heading">
      <h1 id="library-heading">Your library</h1>
      <input ref={searchInput} type="search" aria-label="Search bookmarks" placeholder="Search titles, links, and notes" value={search} onChange={(event) => setSearch(event.target.value)} />
      {notice && <p className={`feedback ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      {loading && <p className="panel" role="status">Loading bookmarks…</p>}
      {bookmarks?.length === 0 && (
        <div className="panel">
          <h2>No saved pages yet</h2>
          <p>Save a page from Capture to start your library.</p>
          <button className="text-button" type="button" onClick={onCapture}>Go to Capture <span aria-hidden="true">→</span></button>
        </div>
      )}
      {Boolean(query && bookmarks?.length && !results?.length) && (
        <div className="panel">
          <h2>No matching bookmarks</h2>
          <button className="text-button" type="button" onClick={() => {
            setSearch('')
            searchInput.current?.focus()
          }}>Clear search</button>
        </div>
      )}
      {results && results.length > 0 && (
        <ul className="bookmarks">
          {results.map((bookmark) => {
            const url = normalizeBookmarkUrl(bookmark.url)
            return (
              <li key={bookmark.id} className="bookmark">
                <div className="bookmark-title">
                  <h2>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{bookmark.title}</a> : bookmark.title}</h2>
                  <div className="bookmark-actions">
                    <button type="button" className="text-button" aria-label={`Explore ${bookmark.title} in graph`} onClick={() => onGraph(bookmark.id)}>Graph</button>
                    <button type="button" className="delete-button" aria-label={`Delete ${bookmark.title}`} disabled={pending !== null} onClick={() => void deleteBookmark(bookmark)}>
                      {pending === bookmark.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
                <p className="bookmark-meta">
                  <span title={bookmark.url}>{url ? new URL(url).hostname : bookmark.url}</span>
                  <time dateTime={bookmark.createdAt}>{dateFormat.format(new Date(bookmark.createdAt))}</time>
                </p>
                {bookmark.notes && <p className="bookmark-notes">{bookmark.notes}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
