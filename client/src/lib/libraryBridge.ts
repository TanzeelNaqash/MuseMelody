import type { Track } from '@shared/schema'

const FAVORITES_KEY = 'aerogroove:favorites'
const COLLECTIONS_KEY = 'aerogroove:collections'

interface StoredFavorite {
  track: Track
  addedAt: number
}

type FavoritesStore = Record<string, StoredFavorite>
type CollectionsStore = Record<string, Track[]>

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function readFavorites(): FavoritesStore {
  if (!hasWindow()) return {}
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as FavoritesStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeFavorites(store: FavoritesStore) {
  if (!hasWindow()) return
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(store))
  } catch {
    // ignore quota/storage errors
  }
}

function readCollections(): CollectionsStore {
  if (!hasWindow()) return {}
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CollectionsStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCollections(store: CollectionsStore) {
  if (!hasWindow()) return
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(store))
  } catch {
    // ignore quota/storage errors
  }
}

export function addToFavorites(track: Track) {
  const store = readFavorites()
  const key = track.youtubeId || track.id
  store[key] = { track, addedAt: Date.now() }
  writeFavorites(store)
}

export function removeFromFavorites(trackId: string) {
  const store = readFavorites()
  delete store[trackId]
  writeFavorites(store)
}

export function isFavorite(trackId: string): boolean {
  const store = readFavorites()
  return Boolean(store[trackId])
}

export function getCollectionNames(): string[] {
  const store = readCollections()
  return Object.keys(store)
}

export function addTrackToCollection(collectionName: string, track: Track) {
  if (!collectionName.trim()) return
  const store = readCollections()
  const existing = store[collectionName] ?? []
  const deduped = [track, ...existing.filter((item) => (item.youtubeId || item.id) !== (track.youtubeId || track.id))]
  store[collectionName] = deduped
  writeCollections(store)
}


