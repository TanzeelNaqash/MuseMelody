import { create } from 'zustand';
import type { Track } from '@shared/schema';

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isRepeat: boolean;
  isShuffle: boolean;
  currentTime: number;
  duration: number;
  audioOnlyMode: boolean;
  showLyrics: boolean;
  
  // Actions
  setCurrentTrack: (track: Track) => void;
  setQueue: (tracks: Track[]) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  toggleAudioOnlyMode: () => void;
  toggleLyrics: () => void;
  clearQueue: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 0.7,
  isMuted: false,
  isRepeat: false,
  isShuffle: false,
  currentTime: 0,
  duration: 0,
  audioOnlyMode: true,
  showLyrics: false,

  setCurrentTrack: (track) => set({ currentTrack: track, isPlaying: true }),
  
  setQueue: (tracks) => set({ queue: tracks }),
  
  addToQueue: (track) => set((state) => ({ 
    queue: [...state.queue, track] 
  })),
  
  removeFromQueue: (index) => set((state) => ({ 
    queue: state.queue.filter((_, i) => i !== index) 
  })),
  
  playNext: () => {
    const { queue, currentTrack } = get();
    if (queue.length === 0) return;
    
    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
    const nextIndex = (currentIndex + 1) % queue.length;
    set({ currentTrack: queue[nextIndex], isPlaying: true, currentTime: 0 });
  },
  
  playPrevious: () => {
    const { queue, currentTrack } = get();
    if (queue.length === 0) return;
    
    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
    const prevIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    set({ currentTrack: queue[prevIndex], isPlaying: true, currentTime: 0 });
  },
  
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleRepeat: () => set((state) => ({ isRepeat: !state.isRepeat })),
  toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),
  
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  
  toggleAudioOnlyMode: () => set((state) => ({ audioOnlyMode: !state.audioOnlyMode })),
  toggleLyrics: () => set((state) => ({ showLyrics: !state.showLyrics })),
  
  clearQueue: () => set({ queue: [], currentTrack: null, isPlaying: false }),
}));
