import { useState } from 'react'
import { Capture } from './components/Capture'
import { Graph } from './components/Graph'
import { Library } from './components/Library'
import { useBookmarks } from './hooks/useBookmarks'
import './App.css'

const params = new URLSearchParams(window.location.search)
const expanded = params.get('view') === 'graph'

function App() {
  const [view, setView] = useState<'capture' | 'library' | 'graph'>(expanded ? 'graph' : 'capture')
  const [selectedId, setSelectedId] = useState(params.get('page') ?? '')
  const [notes, setNotes] = useState('')
  const { library, refresh } = useBookmarks()
  const graph = library.status === 'ready' ? library.graph : undefined
  const bookmarks = graph?.bookmarks

  return (
    <div className={expanded ? 'graph-workspace' : 'popup'}>
      <header className="masthead">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /></span>RabbitHole</div>
        <span className="storage-label">Stored locally</span>
      </header>

      {!expanded && <nav className="navigation" aria-label="RabbitHole views">
        <button type="button" aria-current={view === 'capture' ? 'page' : undefined} onClick={() => setView('capture')}>
          Capture
        </button>
        <button type="button" aria-current={view === 'library' ? 'page' : undefined} onClick={() => setView('library')}>
          Library {bookmarks && <span className="count" aria-label={`${bookmarks.length} bookmarks`}>{bookmarks.length}</span>}
        </button>
        <button type="button" aria-current={view === 'graph' ? 'page' : undefined} onClick={() => setView('graph')}>
          Graph
        </button>
      </nav>}

      <main className="content">
        {library.status === 'error' && (
          <div className="feedback error" role="alert">
            Couldn’t read local storage. <button type="button" className="text-button" onClick={() => void refresh()}>Try again</button>
          </div>
        )}
        {view === 'capture' && <Capture bookmarks={bookmarks} notes={notes} setNotes={setNotes} onLibrary={() => setView('library')} refresh={refresh} />}
        {view === 'library' && (
          <Library
            bookmarks={bookmarks}
            loading={library.status === 'loading'}
            onCapture={() => setView('capture')}
            onGraph={(id) => {
              setSelectedId(id)
              setView('graph')
            }}
            refresh={refresh}
          />
        )}
        {view === 'graph' && (
          <Graph
            graph={graph}
            loading={library.status === 'loading'}
            requestedId={selectedId}
            expanded={expanded}
            onSelect={setSelectedId}
            onCapture={() => setView('capture')}
            refresh={refresh}
          />
        )}
      </main>
    </div>
  )
}

export default App
