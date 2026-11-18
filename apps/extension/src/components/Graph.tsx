import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { normalizeBookmarkUrl } from '../services/bookmarkUrl'
import { getBookmarkRepository } from '../services/browser'
import { suggestConnections } from '../services/suggestConnections'
import type { Bookmark, BookmarkGraph } from '../types/bookmark'
import { ConnectionMap, NEIGHBORS_PER_MAP } from './ConnectionMap'
import type { MapNeighbor } from './ConnectionMap'

interface GraphProps {
  graph: BookmarkGraph | undefined
  loading: boolean
  requestedId: string
  expanded: boolean
  onSelect: (id: string) => void
  onCapture: () => void
  refresh: () => Promise<void>
}

interface PageConnectionsProps {
  selected: Bookmark
  neighbors: Bookmark[]
  candidates: Bookmark[]
  onSelect: (id: string) => void
  refresh: () => Promise<void>
}

export function Graph({ graph, loading, requestedId, expanded, onSelect, onCapture, refresh }: GraphProps) {
  const selected = graph?.bookmarks.find(({ id }) => id === requestedId) ?? graph?.bookmarks[0]
  const relatedIds = new Set<string>()
  if (graph && selected) {
    for (const [first, second] of graph.connections) {
      if (first === selected.id) relatedIds.add(second)
      if (second === selected.id) relatedIds.add(first)
    }
  }

  return (
    <section className="view graph-view" aria-labelledby="graph-heading">
      <div className="graph-heading">
        <h1 id="graph-heading">Research graph</h1>
        {!expanded && selected && (
          <a className="text-button" href={`?view=graph&page=${encodeURIComponent(selected.id)}`} target="_blank" rel="noopener noreferrer">
            Open full view <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
      {loading && <p className="panel" role="status">Loading your graph…</p>}
      {graph && !selected && (
        <div className="panel">
          <h2>No pages to connect yet</h2>
          <p>Save two pages to start a research thread.</p>
          {!expanded && <button className="text-button" type="button" onClick={onCapture}>Go to Capture <span aria-hidden="true">→</span></button>}
        </div>
      )}
      {graph && selected && (
        <>
          <label className="graph-picker">
            <span>Explore from</span>
            <select value={selected.id} onChange={(event) => onSelect(event.target.value)}>
              {graph.bookmarks.map(({ id, title, url }) => <option key={id} value={id}>{title} — {url}</option>)}
            </select>
          </label>
          <PageConnections
            key={selected.id}
            selected={selected}
            neighbors={graph.bookmarks.filter(({ id }) => relatedIds.has(id))}
            candidates={graph.bookmarks.filter(({ id }) => id !== selected.id && !relatedIds.has(id))}
            onSelect={onSelect}
            refresh={refresh}
          />
        </>
      )}
    </section>
  )
}

function PageConnections({ selected, neighbors, candidates, onSelect, refresh }: PageConnectionsProps) {
  const [targetId, setTargetId] = useState('')
  const [batch, setBatch] = useState(0)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string }>()
  const writing = useRef(false)
  const url = normalizeBookmarkUrl(selected.url)
  const suggestions = useMemo(() => suggestConnections(selected, candidates).map(({ bookmark, terms }) => ({
    bookmark,
    reason: `Both mention ${terms.map((term) => `“${term}”`).join(', ')}.`,
  })), [selected, candidates])
  const mapNeighbors = useMemo(() => {
    const confirmed: MapNeighbor[] = neighbors.map((bookmark) => ({ bookmark }))
    const firstPageConfirmed = NEIGHBORS_PER_MAP - suggestions.length
    return [...confirmed.slice(0, firstPageConfirmed), ...suggestions, ...confirmed.slice(firstPageConfirmed)]
  }, [neighbors, suggestions])
  const totalBatches = Math.max(1, Math.ceil(mapNeighbors.length / NEIGHBORS_PER_MAP))
  const visibleBatch = Math.min(batch, totalBatches - 1)
  const visibleNeighbors = useMemo(() => {
    const firstIndex = visibleBatch * NEIGHBORS_PER_MAP
    return mapNeighbors.slice(firstIndex, firstIndex + NEIGHBORS_PER_MAP)
  }, [mapNeighbors, visibleBatch])
  const visibleConfirmed = visibleNeighbors.filter(({ reason }) => !reason)
  const validTarget = candidates.some(({ id }) => id === targetId)
  const pageHeading = useRef<HTMLHeadingElement>(null)

  function followConnection(id: string) {
    onSelect(id)
    // The selected page changes and replaces the node that held focus.
    requestAnimationFrame(() => document.getElementById('map-center')?.focus({ preventScroll: true }))
  }

  async function updateConnection(id: string, operation: 'connect' | 'disconnect') {
    if (writing.current) return
    writing.current = true
    setPending(true)
    setFeedback(undefined)
    try {
      await getBookmarkRepository()[operation](selected.id, id)
      await refresh()
      if (operation === 'connect') setTargetId('')
      if (operation === 'disconnect') pageHeading.current?.focus()
      setFeedback({ kind: 'success', text: operation === 'connect' ? 'Pages connected.' : 'Connection removed.' })
    } catch {
      setFeedback({ kind: 'error', text: 'Couldn’t update the connection. Try again.' })
    } finally {
      writing.current = false
      setPending(false)
    }
  }

  function submitConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (validTarget) void updateConnection(targetId, 'connect')
  }

  return (
    <div className="graph-layout">
      <div className="map-panel">
        <ConnectionMap selected={selected} neighbors={visibleNeighbors} onSelect={followConnection} />
        <div className="map-footer">
          <p>{neighbors.length === 1 ? '1 connection' : `${neighbors.length} connections`}</p>
          {suggestions.length > 0 && <a className="map-suggestion-count" href="#suggested-connections">{suggestions.length} suggested</a>}
          {totalBatches > 1 && (
            <div className="map-pagination">
              <button className="text-button" type="button" aria-label="Previous connections" disabled={visibleBatch === 0} onClick={() => setBatch(visibleBatch - 1)}>←</button>
              <span>{visibleBatch + 1} of {totalBatches}</span>
              <button className="text-button" type="button" aria-label="More connections" disabled={visibleBatch === totalBatches - 1} onClick={() => setBatch(visibleBatch + 1)}>→</button>
            </div>
          )}
        </div>
      </div>

      <div className="graph-details">
        <div className="graph-selection">
          <h2 ref={pageHeading} id="selected-page-heading" tabIndex={-1}>{selected.title}</h2>
          {url && <a className="text-button" href={url} target="_blank" rel="noopener noreferrer">Open article <span aria-hidden="true">↗</span></a>}
          {selected.notes && <p className="bookmark-notes">{selected.notes}</p>}
        </div>

        {feedback && <p className={`feedback ${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
        {suggestions.length > 0 && (
          <div className="connection-list suggestions">
            <h3 id="suggested-connections" tabIndex={-1}>Suggested connections</h3>
            <ul>
              {suggestions.map(({ bookmark, reason }) => (
                <li key={bookmark.id}>
                  <div className="suggestion-details">
                    <button type="button" className="text-button" onClick={() => followConnection(bookmark.id)}>{bookmark.title}</button>
                    <p>{reason}</p>
                  </div>
                  <button type="button" className="keep-button" disabled={pending} aria-label={`Keep connection to ${bookmark.title}`} onClick={() => void updateConnection(bookmark.id, 'connect')}>Keep</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {candidates.length > 0 && suggestions.length === 0 && <p className="graph-hint">No suggestions for this page yet.</p>}
        {candidates.length > 0 && (
          <form className="connection-form" onSubmit={submitConnection}>
            <label htmlFor="connection-target">Connect to a saved page</label>
            <div>
              <select id="connection-target" value={validTarget ? targetId : ''} onChange={(event) => setTargetId(event.target.value)} disabled={pending}>
                <option value="">Choose a page</option>
                {candidates.map(({ id, title, url }) => <option key={id} value={id}>{title} — {url}</option>)}
              </select>
              <button className="primary" type="submit" disabled={!validTarget || pending}>Connect</button>
            </div>
          </form>
        )}
        {candidates.length === 0 && neighbors.length === 0 && <p className="graph-hint">Save another page to make your first connection.</p>}
        {visibleConfirmed.length > 0 && (
          <div className="connection-list">
            <h3>Connected pages</h3>
            <ul>
              {visibleConfirmed.map(({ bookmark: { id, title } }) => (
                <li key={id}>
                  <button type="button" className="text-button" onClick={() => followConnection(id)}>{title}</button>
                  <button type="button" className="delete-button" disabled={pending} aria-label={`Unlink ${title}`} onClick={() => void updateConnection(id, 'disconnect')}>Unlink</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
