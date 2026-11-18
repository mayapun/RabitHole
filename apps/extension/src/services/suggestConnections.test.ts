import { describe, expect, it } from 'vitest'
import type { Bookmark } from '../types/bookmark'
import { suggestConnections } from './suggestConnections'

function page(id: string, title: string, notes = ''): Bookmark {
  return { id, title, notes, url: `https://example.test/${id}`, createdAt: '2026-11-17T00:00:00.000Z' }
}

describe('suggested connections', () => {
  it('explains a title match across case and punctuation', () => {
    const selected = page('partitions', 'How KAFKA Partitions Work')
    const match = page('ordering', 'Ordering guarantees in Kafka: a guide')
    const unrelated = page('bread', 'How Sourdough Works')

    expect(suggestConnections(selected, [unrelated, match])).toEqual([
      { bookmark: match, terms: ['kafka'] },
    ])
  })

  it('uses notes to surface pages with different titles, ranking shared titles higher', () => {
    const selected = page('partitions', 'Kafka partitions', 'Compare idempotency and guarantees')
    const noteMatch = page('delivery', 'Delivery semantics', 'idempotency and guarantees')
    const titleMatch = page('ordering', 'Kafka ordering')

    expect(suggestConnections(selected, [noteMatch, titleMatch])).toEqual([
      { bookmark: titleMatch, terms: ['kafka'] },
      { bookmark: noteMatch, terms: ['guarantees', 'idempotency'] },
    ])
  })

  it('ignores generic words and a lone term shared only by notes', () => {
    const selected = page('one', 'How to use sourdough', 'Recipe')
    const unrelated = page('two', 'How to use Chrome', 'Recipe')
    expect(suggestConnections(selected, [unrelated])).toEqual([])
  })

  it('shows up to four matches and gives up to three reasons for each', () => {
    const selected = page('one', 'Kafka ordering partition guarantees')
    const candidates = Array.from({ length: 6 }, (_, index) =>
      page(String(index), 'Kafka ordering partition guarantees'),
    )
    const suggestions = suggestConnections(selected, candidates)
    expect(suggestions.map(({ bookmark }) => bookmark.id)).toEqual(['0', '1', '2', '3'])
    expect(suggestions.every(({ terms }) => terms.length === 3)).toBe(true)
  })
})
