import type { Track } from '@shared/schema'

export interface SearchBridgeResult {
  id: string
  title: string
  artist?: string | null
  thumbnailUrl?: string | null
  duration?: number | null
}

export function searchResultToTrack(result: SearchBridgeResult): Track {
  const youtubeId = result.id
  return {
    id: youtubeId,
    youtubeId,
    title: result.title ?? 'Unknown Title',
    artist: result.artist ?? undefined,
    thumbnail: result.thumbnailUrl ?? undefined,
    duration: typeof result.duration === 'number' ? result.duration : undefined,
    source: 'youtube',
  }
}


