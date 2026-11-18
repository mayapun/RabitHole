import { useEffect, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { normalizeBookmarkUrl } from '../services/bookmarkUrl'
import { getActivePage, getBookmarkRepository } from '../services/browser'
import type { ActivePage } from '../services/browser'
import type { Bookmark } from '../types/bookmark'

type PageState =
  | { status: 'loading' | 'unsupported' | 'error' }
  | { status: 'ready'; page: ActivePage }

interface CaptureProps {
  bookmarks: Bookmark[] | undefined
  notes: string
  setNotes: Dispatch<SetStateAction<string>>
  onLibrary: () => void
  refresh: () => Promise<void>
}

export function Capture({ bookmarks, notes, setNotes, onLibrary, refresh }: CaptureProps) {
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' })
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'duplicate' | 'error'>('idle')
  const [attempt, setAttempt] = useState(0)
  const saving = useRef(false)
  const libraryButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let active = true
    void getActivePage().then(
      (page) => {
        if (active) setPageState(page ? { status: 'ready', page } : { status: 'unsupported' })
      },
      () => {
        if (active) setPageState({ status: 'error' })
      },
    )
    return () => { active = false }
  }, [attempt])

  useEffect(() => {
    if (state === 'saved' || state === 'duplicate') libraryButton.current?.focus()
  }, [state])

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pageState.status !== 'ready' || saving.current) return

    saving.current = true
    setState('saving')
    try {
      const result = await getBookmarkRepository().save({ ...pageState.page, notes })
      if (result.status === 'saved') setNotes((current) => current === notes ? '' : current)
      await refresh()
      setState(result.status)
    } catch {
      setState('error')
    } finally {
      saving.current = false
    }
  }

  if (pageState.status !== 'ready') {
    return (
      <section className="view" aria-labelledby="capture-heading">
        <h1 id="capture-heading">Save this page</h1>
        {pageState.status === 'loading' && <p className="panel" role="status">Reading the current tab…</p>}
        {pageState.status === 'unsupported' && (
          <div className="panel">
            <h2>This tab can’t be saved</h2>
            <p>Open an HTTP or HTTPS page, then click the RabbitHole icon again.</p>
            <button type="button" className="text-button" onClick={onLibrary}>Browse your library <span aria-hidden="true">→</span></button>
          </div>
        )}
        {pageState.status === 'error' && (
          <div className="feedback error" role="alert">
            Couldn’t read the current tab.{' '}
            <button type="button" className="text-button" onClick={() => {
              setPageState({ status: 'loading' })
              setAttempt(attempt + 1)
            }}>Try again</button>
          </div>
        )}
      </section>
    )
  }

  const { page } = pageState
  const isSaving = state === 'saving'
  const alreadySaved = !isSaving && (bookmarks
    ? bookmarks.some((bookmark) => normalizeBookmarkUrl(bookmark.url) === page.url)
    : state === 'saved' || state === 'duplicate')

  return (
    <section className="view" aria-labelledby="capture-heading">
      <h1 id="capture-heading">Save this page</h1>
      <div className="page-card">
        <span className="page-icon" aria-hidden="true" />
        <div className="page-details">
          <h2>{page.title}</h2>
          <p title={page.url}>{page.url}</p>
        </div>
      </div>
      {alreadySaved ? (
        <div className="saved-actions">
          <p role="status" className="feedback success">
            <span aria-hidden="true">✓</span> {state === 'saved' ? 'Saved to your library.' : 'This page is already in your library.'}
          </p>
          <button ref={libraryButton} type="button" className="primary" onClick={onLibrary}>View library <span aria-hidden="true">→</span></button>
        </div>
      ) : (
        <form className="capture-form" onSubmit={(event) => void savePage(event)}>
          <label htmlFor="notes">Personal note <span>Optional</span></label>
          <textarea id="notes" rows={3} placeholder="What made this worth saving?" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} />
          {state === 'error' && <p className="feedback error" role="alert">Couldn’t save this page. Your note is still here. Try again.</p>}
          <button className="primary" type="submit" disabled={isSaving || !bookmarks}>
            {isSaving ? 'Saving…' : 'Save page'} <span aria-hidden="true">{isSaving ? '' : '↓'}</span>
          </button>
        </form>
      )}
    </section>
  )
}
