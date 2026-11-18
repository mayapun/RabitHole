export interface SaveBookmark {
  title: string
  url: string
  notes: string
}

export interface Bookmark extends SaveBookmark {
  id: string
  createdAt: string
}

export type SaveResult = {
  status: 'saved' | 'duplicate'
  bookmark: Bookmark
}

export type BookmarkConnection = [firstId: string, secondId: string]

export interface BookmarkGraph {
  bookmarks: Bookmark[]
  connections: BookmarkConnection[]
}
