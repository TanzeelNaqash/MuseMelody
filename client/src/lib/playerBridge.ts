import type { Track } from '@shared/schema'
import { usePlayerStore } from './playerStore'

interface PlayTrackOptions {
  queue?: Track[]
  replaceQueue?: boolean
}

export async function playTrack(track: Track, options: PlayTrackOptions = {}) {
  const store = usePlayerStore.getState()
  store.setCurrentTrack(track)

  if (options.queue) {
    if (options.replaceQueue ?? true) {
      store.setQueue(options.queue)
    } else {
      // Merge queue keeping unique IDs while preserving order.
      const merged = [
        ...options.queue,
        ...store.queue.filter((existing) => !options.queue!.some((candidate) => candidate.id === existing.id)),
      ]
      store.setQueue(merged)
    }
    return
  }

  const queue = store.queue
  const isAlreadyFirst = queue[0]?.id === track.id
  if (isAlreadyFirst) return

  const nextQueue = [track, ...queue.filter((item) => item.id !== track.id)]
  store.setQueue(nextQueue)
}


