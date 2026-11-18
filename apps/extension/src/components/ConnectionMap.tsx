import { useEffect, useRef } from 'react'
import type { Bookmark } from '../types/bookmark'

export const NEIGHBORS_PER_MAP = 8

export interface MapNeighbor {
  bookmark: Bookmark
  reason?: string
}

const positions = [
  { x: 50, y: 16 },
  { x: 82, y: 50 },
  { x: 50, y: 84 },
  { x: 18, y: 50 },
  { x: 18, y: 16 },
  { x: 82, y: 16 },
  { x: 82, y: 84 },
  { x: 18, y: 84 },
]

interface ConnectionMapProps {
  selected: Bookmark
  neighbors: MapNeighbor[]
  onSelect: (id: string) => void
}

export function ConnectionMap({ selected, neighbors, onSelect }: ConnectionMapProps) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return

    function drawEdges(element: HTMLCanvasElement, context: CanvasRenderingContext2D) {
      const { clientWidth: width, clientHeight: height } = element
      const scale = window.devicePixelRatio
      element.width = Math.round(width * scale)
      element.height = Math.round(height * scale)
      context.setTransform(scale, 0, 0, scale, 0, 0)
      context.lineWidth = 2
      neighbors.forEach(({ reason }, index) => {
        const { x, y } = positions[index]
        context.strokeStyle = reason ? '#a35e26' : '#9b7fce'
        context.setLineDash(reason ? [2, 5] : [])
        context.lineCap = reason ? 'round' : 'butt'
        context.beginPath()
        context.moveTo(width / 2, height / 2)
        context.lineTo(width * x / 100, height * y / 100)
        context.stroke()
      })
    }

    drawEdges(element, context)
    const observer = new ResizeObserver(() => drawEdges(element, context))
    observer.observe(element)
    return () => observer.disconnect()
  }, [neighbors])

  return (
    <div className="connection-map" role="group" aria-label="Selected page and its direct connections">
      <canvas ref={canvas} aria-hidden="true" />
      <div id="map-center" className="map-node map-center" tabIndex={-1} title={selected.title}>
        <span className="map-node-label">Selected page</span>
        <strong>{selected.title}</strong>
      </div>
      {neighbors.map(({ bookmark, reason }, index) => (
        <button
          key={bookmark.id}
          type="button"
          className={`map-node map-neighbor${reason ? ' map-suggested' : ''}`}
          title={reason ?? bookmark.title}
          aria-label={reason ? `${bookmark.title}, suggested. ${reason}` : undefined}
          style={{ left: `${positions[index].x}%`, top: `${positions[index].y}%` }}
          onClick={() => onSelect(bookmark.id)}
        >
          <strong>{bookmark.title}</strong>
          {reason && <span className="map-node-label">Suggested</span>}
        </button>
      ))}
    </div>
  )
}
