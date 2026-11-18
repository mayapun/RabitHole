import type { Bookmark } from '../types/bookmark'

const commonWords = new Set(`
  about after also another article before being between both could from guide have help here how into
  just learn make more most need next notes other over page part section should some steps take than
  that their them then there these they this those through time tips using useful very want were
  what when where which while will with work would your can for the and but not you all new use
`.trim().split(/\s+/))

const MAX_SUGGESTIONS = 4
const MAX_EXPLAINED_TERMS = 3

interface ConnectionSuggestion {
  bookmark: Bookmark
  terms: string[]
}

function words(text: string): string[] {
  return (text.normalize('NFKC').toLowerCase().match(/\p{L}[\p{L}\p{M}\p{N}]*/gu) ?? [])
    .filter((word) => word.length >= 3 && !commonWords.has(word))
}

function weightedTerms(bookmark: Bookmark): Map<string, number> {
  const terms = new Map(words(bookmark.notes).map((word) => [word, 1]))
  for (const word of words(bookmark.title)) terms.set(word, 2)
  return terms
}

export function suggestConnections(selected: Bookmark, candidates: Bookmark[]): ConnectionSuggestion[] {
  const selectedTerms = weightedTerms(selected)
  const suggestions = candidates.map((bookmark) => {
    const candidateTerms = weightedTerms(bookmark)
    const shared = [...selectedTerms.entries()]
      .map(([term, weight]) => ({ term, weight: weight * (candidateTerms.get(term) ?? 0) }))
      .filter(({ weight }) => weight > 0)
      .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
      .slice(0, MAX_EXPLAINED_TERMS)

    return {
      bookmark,
      terms: shared.map(({ term }) => term),
      score: shared.reduce((total, { weight }) => total + weight, 0),
    }
  })

  return suggestions
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ bookmark, terms }) => ({ bookmark, terms }))
}
