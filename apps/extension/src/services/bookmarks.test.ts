import { describe, expect, it, vi } from 'vitest'
import type { Bookmark, BookmarkGraph } from '../types/bookmark'
import { createBookmarkRepository } from './bookmarks'
import { normalizeBookmarkUrl } from './bookmarkUrl'

const page = { title: '  Event ordering  ', url: 'HTTPS://Example.COM:443/articles', notes: '  Read again  ' }

function setup(initial?: Bookmark[]) {
  let stored: Partial<BookmarkGraph> = { bookmarks: structuredClone(initial) }
  const storage = {
    get: vi.fn(async () => structuredClone(stored)),
    set: vi.fn(async (items: Partial<BookmarkGraph>) => {
      stored = { ...stored, ...structuredClone(items) }
    }),
  }
  let lastWrite: Promise<unknown> = Promise.resolve()
  const locks = {
    request<T>(_name: string, callback: () => Promise<T>) {
      const write = lastWrite.then(callback)
      lastWrite = write.catch(() => {})
      return write
    },
  }
  return { storage, repository: createBookmarkRepository(storage, locks), locks }
}

describe('bookmark URLs', () => {
  it('normalizes URL syntax while keeping query order, repeated values, and fragments', () => {
    expect(normalizeBookmarkUrl(' HTTPS://EXAMPLE.Com:443/a/../b?z=1&tag=x&tag=y#a ')).toBe(
      'https://example.com/b?z=1&tag=x&tag=y#a',
    )
    expect(normalizeBookmarkUrl('https://EXAMPLE.com?#')).toBe('https://example.com/')
  })

  it.each(['', 'example.com', 'chrome://settings', 'file:///page.html', 'https://user:pass@example.com'])(
    'rejects unsupported or invalid URLs (%s)',
    (url) => expect(normalizeBookmarkUrl(url)).toBeNull(),
  )
})

describe('bookmark connections', () => {
  const bookmarks: Bookmark[] = ['alpha', 'bravo', 'charlie'].map((id) => ({
    ...page,
    id,
    url: `https://example.com/${id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
  }))

  it('opens a library saved before connections existed', async () => {
    const { repository, storage } = setup(bookmarks)
    await expect(repository.readGraph()).resolves.toEqual({ bookmarks, connections: [] })
    expect(storage.set).not.toHaveBeenCalled()
  })

  it('stores one bidirectional connection, including across simultaneous writes', async () => {
    const { repository, storage, locks } = setup(bookmarks)
    const secondRepository = createBookmarkRepository(storage, locks)
    await Promise.all([
      repository.connect('bravo', 'alpha'),
      secondRepository.connect('alpha', 'bravo'),
    ])
    await expect(repository.readGraph()).resolves.toEqual({ bookmarks, connections: [['alpha', 'bravo']] })
    expect(storage.set).toHaveBeenCalledTimes(1)
    await secondRepository.disconnect('bravo', 'alpha')
    await expect(repository.readGraph()).resolves.toEqual({ bookmarks, connections: [] })
  })

  it('rejects self-links and missing endpoints without writing', async () => {
    const { repository, storage } = setup(bookmarks)
    await expect(repository.connect('alpha', 'alpha')).rejects.toThrow('different bookmarks')
    await expect(repository.connect('alpha', 'missing')).rejects.toThrow('still be saved')
    expect(storage.set).not.toHaveBeenCalled()
  })

  it('deletes incident connections in the same write and retains unrelated ones', async () => {
    const { repository, storage } = setup(bookmarks)
    await repository.connect('alpha', 'bravo')
    await repository.connect('alpha', 'charlie')
    await repository.connect('bravo', 'charlie')
    storage.set.mockRejectedValueOnce(new Error('quota'))
    await expect(repository.remove('alpha')).rejects.toThrow('quota')
    await expect(repository.readGraph()).resolves.toMatchObject({ bookmarks, connections: expect.arrayContaining([['alpha', 'bravo']]) })
    await repository.remove('alpha')
    const remaining = { bookmarks: bookmarks.slice(1), connections: [['bravo', 'charlie']] }
    expect(storage.set).toHaveBeenLastCalledWith(remaining)
    await expect(repository.readGraph()).resolves.toEqual(remaining)
  })
})

describe('bookmark repository', () => {
  it('lists an empty store and persists every field when saving', async () => {
    const { repository } = setup()
    await expect(repository.list()).resolves.toEqual([])
    const result = await repository.save(page)
    expect(result).toEqual({
      status: 'saved',
      bookmark: {
        id: expect.stringMatching(/^[a-f0-9-]{36}$/),
        title: 'Event ordering',
        url: 'https://example.com/articles',
        notes: 'Read again',
        createdAt: expect.any(String),
      },
    })
    expect(new Date(result.bookmark.createdAt).toISOString()).toBe(result.bookmark.createdAt)
    await expect(repository.list()).resolves.toEqual([result.bookmark])
  })

  it('checks existing normalized URLs without overwriting saved notes', async () => {
    const existing: Bookmark = {
      ...page,
      id: 'existing',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const { repository, storage } = setup([existing])
    await expect(repository.save({ ...page, url: 'https://example.com/articles', notes: 'New note' }))
      .resolves.toEqual({ status: 'duplicate', bookmark: existing })
    expect(storage.set).not.toHaveBeenCalled()
  })

  it('keeps destinations with different query values or fragments', async () => {
    const { repository } = setup()
    for (const url of ['https://example.com/?page=1', 'https://example.com/?page=2', 'https://example.com/?page=2#/chapter']) {
      await expect(repository.save({ ...page, url })).resolves.toMatchObject({ status: 'saved' })
    }
    await expect(repository.list()).resolves.toHaveLength(3)
  })

  it('serializes saves across repositories that share storage and locks', async () => {
    const { repository, storage, locks } = setup()
    const secondRepository = createBookmarkRepository(storage, locks)
    const results = await Promise.all([
      repository.save(page),
      secondRepository.save({ ...page, url: 'https://example.com/articles' }),
      secondRepository.save({ ...page, url: 'https://example.org', title: '' }),
    ])
    expect(results.map(({ status }) => status)).toEqual(['saved', 'duplicate', 'saved'])
    expect((await repository.list()).map(({ title }) => title)).toEqual(['example.org', 'Event ordering'])
  })

  it('deletes only the requested bookmark and makes a repeated deletion safe', async () => {
    const { repository, storage } = setup()
    const first = await repository.save(page)
    const second = await repository.save({ ...page, url: 'https://example.org' })
    await repository.remove(first.bookmark.id)
    await repository.remove(first.bookmark.id)
    await expect(repository.list()).resolves.toEqual([second.bookmark])
    expect(storage.set).toHaveBeenCalledTimes(3)
    await expect(repository.save(page)).resolves.toMatchObject({ status: 'saved' })
  })

  it('rejects unsupported URLs without touching storage', async () => {
    const { repository, storage } = setup()
    await expect(repository.save({ ...page, url: 'javascript:alert(1)' })).rejects.toThrow()
    expect(storage.get).not.toHaveBeenCalled()
    expect(storage.set).not.toHaveBeenCalled()
  })

  it('leaves storage consistent and allows retry after a failed write', async () => {
    const { repository, storage } = setup()
    storage.set.mockRejectedValueOnce(new Error('quota'))
    await expect(repository.save(page)).rejects.toThrow('quota')
    await expect(repository.list()).resolves.toEqual([])
    await expect(repository.save(page)).resolves.toMatchObject({ status: 'saved' })
  })
})
