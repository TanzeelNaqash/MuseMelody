// playerStore-merged.ts
// A single Zustand store that merges your legacy `store` (APIs, settings, linkHost, downloadFormat, etc.)
// with the existing Player store (queue, playback, lyrics, audio-only).
// Drop-in replacement for your current `usePlayerStore` and call `hydrateFromLegacy()` once at app boot.

import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import type { Track as SharedTrack } from '@shared/schema'

// ----- Types -----
export type Quality = 'low' | 'medium' | 'high'
export type ShareAction = 'play' | 'watch' | 'download'
export type CodecPref = 'opus' | 'aac' | 'any'
export type DownloadFormat = 'opus' | 'wav' | 'mp3' | 'ogg'
export type Lang = 'en' | string

export type Track = SharedTrack & {
  /**
   * Optional legacy fields preserved for backwards compatibility.
   * Prefer using the shared Track fields (`artist`, `thumbnail`, etc.).
   */
  author?: string
  duration?: number | string
  channelUrl?: string
  /**
   * Stream source and instance used to fetch this track.
   * Used to maintain consistency when resolving streams.
   */
  streamSource?: 'piped' | 'invidious'
  streamInstance?: string | null
}

export interface ApiConfig {
  piped: string[]
  proxy: string[]
  invidious: string[]
  hyperpipe: string[]
  jiosaavn: string
  /** U: Unknown, P: Piped, I: Invidious, N: None */
  status: 'U' | 'P' | 'I' | 'N'
  /** index of the currently selected base API */
  index: number
}

export interface PlayerCore {
  playbackState: 'none' | 'playing' | 'paused'
  /** current media engine exposes hls-like API; we store just manifest + api list */
  hls: {
    api: string[]
    manifests: string[]
    /** optional helper to set src externally */
    src?: (url: string) => void
  }
  supportsOpus: boolean
  data?: unknown
  legacy: boolean
  fallback: string
  useSaavn: boolean
}

export interface Settings {
  enforceProxy: boolean
  jiosaavn: boolean
  defaultSuperCollection: string
  customInstance: string
  stableVolume: boolean
  prefetch: boolean
  HLS: boolean
  quality: Quality
  loadImage: boolean
  linkHost: string
  dlFormat: DownloadFormat
  theme: 'auto' | string
  customColor: string
  roundness: string
  searchSuggestions: boolean
  searchFilter: string
  startupTab: string
  watchMode: string
  enqueueRelatedStreams: boolean
  shuffle: boolean
  filterLT10: boolean
  allowDuplicates: boolean
  history: boolean
  discover: boolean
  volume: string | number
  shareAction: ShareAction
  dbsync: string
  language: Lang
  codec: CodecPref
  partsManagerPIN: string
  // UI parts toggles
  'part Reserved Collections': boolean
  'part Navigation Library': boolean
  'part Featured Playlists': boolean
  'part Subscription Feed': boolean
  'part Collections': boolean
  'part Start Radio': boolean
  'part View Author': boolean
  'part Playlists': boolean
  'part Channels': boolean
  'part Watch On': boolean
  'part For You': boolean
  'part Artists': boolean
  'part Albums': boolean
}

// Default (legacy-equivalent) settings
const defaultSettings: Settings = {
  enforceProxy: false,
  jiosaavn: false,
  defaultSuperCollection: 'featured',
  customInstance: '',
  stableVolume: false,
  prefetch: false,
  HLS: false,
  quality: 'medium',
  loadImage: true,
  linkHost: '',
  dlFormat: 'opus',
  theme: 'auto',
  customColor: '',
  roundness: '0.4rem',
  searchSuggestions: true,
  searchFilter: '',
  startupTab: '/search',
  watchMode: '',
  enqueueRelatedStreams: false,
  shuffle: false,
  filterLT10: false,
  allowDuplicates: false,
  history: true,
  discover: true,
  volume: '100',
  shareAction: 'play',
  dbsync: '',
  language: 'en',
  codec: 'any',
  partsManagerPIN: '',
  'part Reserved Collections': true,
  'part Navigation Library': true,
  'part Featured Playlists': true,
  'part Subscription Feed': true,
  'part Collections': true,
  'part Start Radio': true,
  'part View Author': true,
  'part Playlists': true,
  'part Channels': true,
  'part Watch On': true,
  'part For You': true,
  'part Artists': true,
  'part Albums': true,
}

function getInitialLegacyFlag(): boolean {
  return !('OffscreenCanvas' in window)
}

async function detectOpusSupport(): Promise<boolean> {
  try {
    // @ts-ignore: mediaCapabilities exists in modern browsers
    const res = await navigator.mediaCapabilities?.decodingInfo?.({
      type: 'file',
      audio: { contentType: 'audio/webm;codecs=opus' },
    })
    return !!res?.supported
  } catch (_) {
    return false
  }
}

function fromURLParams(): Partial<Record<keyof Settings, any>> {
  const params = new URL(window.location.href).searchParams
  const linkHost = params.get('linkHost') || undefined
  return {
    ...(linkHost ? { linkHost } : {}),
  }
}

function mergeSettings(): Settings {
  // Prefer the old localStorage key `store` if present for backwards compat
  const savedRaw = localStorage.getItem('store')
  let base = { ...defaultSettings }
  try {
    if (savedRaw) base = { ...base, ...(JSON.parse(savedRaw) as Partial<Settings>) }
  } catch {}
  base = { ...base, ...fromURLParams() }
  return base
}

// ----- Global Store -----
export interface PlayerStoreState {
  // Core player
  player: PlayerCore

  // Queueing & playback
  currentTrack: Track | null
  queue: Track[]
  isPlaying: boolean
  isMuted: boolean
  isRepeat: boolean
  isShuffle: boolean
  currentTime: number
  duration: number
  volume: number | string
  audioOnlyMode: boolean
  videoModalOpen: boolean
  showLyrics: boolean
  audioElement: HTMLAudioElement | null
  videoElement: HTMLVideoElement | null
  pendingSeek: number | null
  isFullscreen: boolean
  isLoadingStream: boolean

  // Settings & API
  settings: Settings
  api: ApiConfig
  linkHost: string
  downloadFormat: DownloadFormat

  // Actions — playback
  setCurrentTrack: (track: Track) => void
  setQueue: (tracks: Track[]) => void
  addToQueue: (track: Track) => void
  removeFromQueue: (index: number) => void
  playNext: () => void
  playPrevious: () => void
  togglePlay: () => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number | string) => void
  toggleMute: () => void
  toggleRepeat: () => void
  toggleShuffle: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  toggleAudioOnlyMode: () => void
  setAudioOnlyMode: (value: boolean) => void
  setVideoModalOpen: (open: boolean) => void
  toggleLyrics: () => void
  clearQueue: () => void
  setAudioElement: (audio: HTMLAudioElement | null) => void
  setVideoElement: (video: HTMLVideoElement | null) => void
  requestSeek: (time: number) => void
  clearPendingSeek: () => void
  toggleFullscreen: () => void
  setFullscreen: (value: boolean) => void
  setIsLoadingStream: (loading: boolean) => void

  // Actions — settings & API
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  setSettings: (patch: Partial<Settings>) => void
  setApiConfig: (patch: Partial<ApiConfig>) => void
  selectApiIndex: (index: number) => void
  setLinkHost: (host: string) => void
  setDownloadFormat: (fmt: DownloadFormat) => void

  // One-time capability probe
  probeCapabilities: () => Promise<void>

  // Back-compat hydration from the legacy `store` shape if needed
  hydrateFromLegacy: (legacy: Partial<{
    api: ApiConfig
    linkHost: string
    downloadFormat: DownloadFormat
    player: Partial<PlayerCore>
    state: Partial<Settings>
  }>) => void
}

const initialSettings = mergeSettings()
const initialVolume =
  typeof initialSettings.volume === 'number'
    ? initialSettings.volume
    : Number.isFinite(Number(initialSettings.volume))
      ? Number(initialSettings.volume)
      : 100

export const usePlayerStore = create<PlayerStoreState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        player: {
          playbackState: 'none',
          hls: { api: ['https://piped.private.coffee'], manifests: [] },
          supportsOpus: false, // will probe
          data: undefined,
          legacy: getInitialLegacyFlag(),
          fallback: '',
          useSaavn: !!initialSettings.jiosaavn,
        },

        currentTrack: null,
        queue: [],
        isPlaying: false,
        isMuted: false,
        isRepeat: false,
        isShuffle: false,
        currentTime: 0,
        duration: 0,
        volume: initialVolume,
        audioOnlyMode: true,
        videoModalOpen: false,
        showLyrics: false,
        audioElement: null,
        videoElement: null,
        pendingSeek: null,
        isFullscreen: false,
        isLoadingStream: false,

        settings: initialSettings,
        api: {
          piped: [
            'https://piped.private.coffee/api/v1',
            'https://piped.video/api/v1',
            'https://piped.lunar.icu/api/v1',
          ],
          proxy: [],
          invidious: [
            'https://y.com.sb',
            'https://iv.melmac.space',
            'https://zoomerville.com',
            'https://inv.perditum.com',
            'https://inv.vern.cc',
            'https://invidious.nikkosphere.com',
            'https://invidious.materialio.us',
          ],
          hyperpipe: [
            'https://hyperpipeapi.darkness.services',
            'https://hyperpipeapi.onrender.com',
            'https://hyperpipebackend.eu.projectsegfau.lt',
            'https://hyperpipebackend.in.projectsegfau.lt',
          ],
          jiosaavn: 'https://jiosavan-ytify.vercel.app',
          status: 'N',
          index: 0,
        },
        linkHost: initialSettings.linkHost || window.location.origin,
        downloadFormat: initialSettings.dlFormat,

        // Playback actions
        setCurrentTrack: (track) => set({ currentTrack: track, isPlaying: true }),
        setQueue: (tracks) => set({ queue: tracks }),
        addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
        removeFromQueue: (index) => set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
        playNext: () => {
          const { queue, currentTrack, isShuffle } = get()
          if (!queue.length) return
          
          const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id)
          
          // If shuffle is enabled, pick a random track (excluding current)
          if (isShuffle) {
            const availableTracks = queue.filter((t) => t.id !== currentTrack?.id)
            if (availableTracks.length === 0) {
              // If only one track, just replay it
              set({ currentTrack, isPlaying: true, currentTime: 0 })
              return
            }
            const randomIndex = Math.floor(Math.random() * availableTracks.length)
            set({ currentTrack: availableTracks[randomIndex], isPlaying: true, currentTime: 0 })
            return
          }
          
          // Normal sequential playback
          const nextIndex = (currentIndex + 1) % queue.length
          set({ currentTrack: queue[nextIndex], isPlaying: true, currentTime: 0 })
        },
        playPrevious: () => {
          const { queue, currentTrack, isShuffle } = get()
          if (!queue.length) return
          
          const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id)
          
          // If shuffle is enabled, pick a random track (excluding current)
          if (isShuffle) {
            const availableTracks = queue.filter((t) => t.id !== currentTrack?.id)
            if (availableTracks.length === 0) {
              // If only one track, just replay it
              set({ currentTrack, isPlaying: true, currentTime: 0 })
              return
            }
            const randomIndex = Math.floor(Math.random() * availableTracks.length)
            set({ currentTrack: availableTracks[randomIndex], isPlaying: true, currentTime: 0 })
            return
          }
          
          // Normal sequential playback
          const prevIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1
          set({ currentTrack: queue[prevIndex], isPlaying: true, currentTime: 0 })
        },
        togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
        setIsPlaying: (playing) => set({ isPlaying: playing }),
        setVolume: (volume) =>
          set(({ settings }) => ({
            volume,
            settings: { ...settings, volume },
          })),
        toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
        toggleRepeat: () => set((s) => ({ isRepeat: !s.isRepeat })),
        toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),
        setCurrentTime: (time) => set({ currentTime: time }),
        setDuration: (duration) => set({ duration }),
        toggleAudioOnlyMode: () => set((s) => ({ audioOnlyMode: !s.audioOnlyMode })),
        setAudioOnlyMode: (value) => set({ audioOnlyMode: value }),
        setVideoModalOpen: (open) => set({ videoModalOpen: open }),
        toggleLyrics: () => set((s) => ({ showLyrics: !s.showLyrics })),
        clearQueue: () => set({ queue: [], currentTrack: null, isPlaying: false }),
        setAudioElement: (audio) => set({ audioElement: audio }),
        setVideoElement: (video) => set({ videoElement: video }),
        requestSeek: (time) => set({ pendingSeek: time }),
        clearPendingSeek: () => set({ pendingSeek: null }),
        toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
        setFullscreen: (value) => set({ isFullscreen: value }),
        setIsLoadingStream: (loading) => set({ isLoadingStream: loading }),

        // Settings & API actions
        setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
        setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        setApiConfig: (patch) => set((s) => ({ api: { ...s.api, ...patch } })),
        selectApiIndex: (index) => set((s) => ({ api: { ...s.api, index } })),
        setLinkHost: (host) => set({ linkHost: host }),
        setDownloadFormat: (fmt) => set({ downloadFormat: fmt, settings: { ...get().settings, dlFormat: fmt } }),

        probeCapabilities: async () => {
          const supported = await detectOpusSupport()
          set((s) => ({ player: { ...s.player, supportsOpus: supported } }))
        },

        hydrateFromLegacy: (legacy) => {
          if (!legacy) return
          set((s) => ({
            api: legacy.api ? { ...s.api, ...legacy.api } : s.api,
            linkHost: legacy.linkHost ?? s.linkHost,
            downloadFormat: legacy.downloadFormat ?? s.downloadFormat,
            player: legacy.player ? { ...s.player, ...legacy.player } : s.player,
            settings: legacy.state ? { ...s.settings, ...legacy.state } : s.settings,
            volume: legacy.state?.volume ?? s.volume,
          }))
        },
      }),
      {
        name: 'player-store', // new persisted key
        version: 2,
        migrate: (persisted, from) => {
          // Handle future migrations here
          return persisted as any
        },
        partialize: (s) => ({
          // Persist only what you want to survive reloads
          settings: s.settings,
          api: s.api,
          linkHost: s.linkHost,
          downloadFormat: s.downloadFormat,
        }),
      }
    )
  )
)

// Convenience helper for boot-time initialization
export function hydrateFromLegacyWindowIfPresent() {
  // If you expose your legacy global as window.__LEGACY_STORE__
  // you can call this once in your app's root to bring over values.
  // @ts-ignore
  const legacy = (window as any).__LEGACY_STORE__
  if (legacy) usePlayerStore.getState().hydrateFromLegacy(legacy)
}

// Example: wiring HLS src setter from your player engine once it exists
export function bindHlsSrcSetter(srcSetter: (url: string) => void) {
  usePlayerStore.setState((s) => ({ player: { ...s.player, hls: { ...s.player.hls, src: srcSetter } } }))
}

// Selectors (optional usage samples)
export const selectors = {
  current: (s: PlayerStoreState) => s.currentTrack,
  queue: (s: PlayerStoreState) => s.queue,
  apis: (s: PlayerStoreState) => s.api,
  settings: (s: PlayerStoreState) => s.settings,
}
