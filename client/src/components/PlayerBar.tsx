import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  List,
  Mic2,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayerStore, type PlayerStoreState } from "@/lib/playerStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { Track as PlayerTrack } from "@/lib/playerStore";

export function PlayerBar() {
  const [, navigate] = useLocation();
  const selector = (state: PlayerStoreState) => ({
    currentTrack: state.currentTrack,
    isPlaying: state.isPlaying,
    togglePlay: state.togglePlay,
    playNext: state.playNext,
    playPrevious: state.playPrevious,
    duration: state.duration,
    currentTime: state.currentTime,
    pendingSeek: state.pendingSeek,
    clearPendingSeek: state.clearPendingSeek,
    requestSeek: state.requestSeek,
    toggleMute: state.toggleMute,
    isMuted: state.isMuted,
    volume: state.volume,
    toggleRepeat: state.toggleRepeat,
    isRepeat: state.isRepeat,
    toggleShuffle: state.toggleShuffle,
    isShuffle: state.isShuffle,
    toggleFullscreen: state.toggleFullscreen,
    isFullscreen: state.isFullscreen,
    audioOnlyMode: state.audioOnlyMode,
    setAudioOnlyMode: state.setAudioOnlyMode,
    videoModalOpen: state.videoModalOpen,
    setVideoModalOpen: state.setVideoModalOpen,
    queue: state.queue,
    setCurrentTrack: state.setCurrentTrack,
    setVolume: state.setVolume,
  });

  const storeSlice = usePlayerStore(
    useShallow((state: PlayerStoreState) => ({
      currentTrack: state.currentTrack,
      isPlaying: state.isPlaying,
      togglePlay: state.togglePlay,
      playNext: state.playNext,
      playPrevious: state.playPrevious,
      duration: state.duration,
      currentTime: state.currentTime,
      pendingSeek: state.pendingSeek,
      clearPendingSeek: state.clearPendingSeek,
      requestSeek: state.requestSeek,
      toggleMute: state.toggleMute,
      isMuted: state.isMuted,
      volume: state.volume,
      toggleRepeat: state.toggleRepeat,
      isRepeat: state.isRepeat,
      toggleShuffle: state.toggleShuffle,
      isShuffle: state.isShuffle,
      toggleFullscreen: state.toggleFullscreen,
      isFullscreen: state.isFullscreen,
      audioOnlyMode: state.audioOnlyMode,
      setAudioOnlyMode: state.setAudioOnlyMode,
      videoModalOpen: state.videoModalOpen,
      setVideoModalOpen: state.setVideoModalOpen,
      queue: state.queue,
      setCurrentTrack: state.setCurrentTrack,
      setVolume: state.setVolume,
      isLoadingStream: state.isLoadingStream,
    })),
  );

  const {
    currentTrack,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    duration,
    currentTime,
    pendingSeek,
    clearPendingSeek,
    requestSeek,
    toggleMute,
    isMuted,
    volume,
    toggleRepeat,
    isRepeat,
    toggleShuffle,
    isShuffle,
    toggleFullscreen,
    isFullscreen,
    audioOnlyMode,
    setAudioOnlyMode,
    videoModalOpen,
    setVideoModalOpen,
    queue,
    setCurrentTrack,
    setVolume,
    isLoadingStream,
  } = storeSlice;

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const parseVolume = (input: number | string) => {
    const numeric = typeof input === "number" ? input : Number(input);
    if (!Number.isFinite(numeric)) return 1;
    return numeric > 1 ? numeric / 100 : numeric;
  };

  const volumeValue = parseVolume(volume);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const displayCurrentTime = useMemo(() => {
    if (scrubTime != null) return scrubTime;
    return currentTime;
  }, [currentTime, scrubTime]);

  const handleSeekChange = (value: number[]) => {
    setScrubTime(value[0]);
  };

  const handleSeekCommit = (value: number[]) => {
    setScrubTime(null);
    requestSeek(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const next = value[0];
    if (Math.abs(next - volumeValue) < 0.0001) return;
    setVolume(next);
  };

  const handleQueueSelect = (track: PlayerTrack) => {
    setCurrentTrack(track);
    requestSeek(0);
    setShowQueuePanel(false);
  };

  const handleVideoToggle = () => {
    if (audioOnlyMode) {
      setAudioOnlyMode(false);
      if (!videoModalOpen) {
        setVideoModalOpen(true);
      }
    } else if (videoModalOpen) {
      setVideoModalOpen(false);
      if (!audioOnlyMode) {
        setAudioOnlyMode(true);
      }
    } else {
      setVideoModalOpen(true);
    }
  };

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-3 pb-1 sm:px-6">
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative mx-auto flex h-auto max-w-[1280px] flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,hsla(210,90%,62%,0.22),transparent_55%),radial-gradient(circle_at_bottom_right,hsla(315,85%,58%,0.18),transparent_45%)] p-4 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:gap-6 md:px-6 md:py-4"
      >
        <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-[0.08]" />
        <div className="relative flex w-full flex-col items-center gap-4 md:flex-row md:gap-6">
        {/* Track Info */}
        <div className="flex w-full items-center gap-3 md:w-1/3">
          <img
            src={currentTrack.thumbnail || '/placeholder.svg'}
            alt={currentTrack.title}
            className={cn(
              "h-14 w-14 flex-shrink-0 rounded-2xl object-cover shadow-lg transition-transform duration-500 lg:h-16 lg:w-16",
              isPlaying ? "scale-100" : "scale-[0.97]",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className="truncate text-sm font-semibold tracking-tight text-foreground md:text-base"
                data-testid="text-current-track-title"
              >
                {currentTrack.title}
              </p>
              {isLoadingStream && (
                <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
              )}
            </div>
            <p
              className="truncate text-xs text-muted-foreground/80 md:text-sm"
              data-testid="text-current-track-artist"
            >
              {currentTrack.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex w-full flex-1 flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 shadow-inner shadow-black/20 backdrop-blur">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleShuffle}
              className={cn(
                "h-9 w-9 rounded-full bg-transparent text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground",
                isShuffle && "text-primary",
              )}
              data-testid="button-shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={playPrevious}
              className="h-10 w-10 rounded-full bg-white/5 text-foreground transition-colors hover:bg-white/15"
              data-testid="button-previous"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              onClick={togglePlay}
              disabled={isLoadingStream}
              className="group h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/40 transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-play-pause"
            >
              {isLoadingStream ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" fill="currentColor" />
              ) : (
                <Play className="h-5 w-5" fill="currentColor" />
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={playNext}
              className="h-10 w-10 rounded-full bg-white/5 text-foreground transition-colors hover:bg-white/15"
              data-testid="button-next"
            >
              <SkipForward className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={toggleRepeat}
              className={cn(
                "h-9 w-9 rounded-full bg-transparent text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground",
                isRepeat && "text-primary",
              )}
              data-testid="button-repeat"
            >
              <Repeat className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="flex w-full max-w-3xl items-center gap-3">
            <span className="w-12 text-right text-xs font-semibold text-white/60 tabular-nums">
              {formatTime(displayCurrentTime)}
            </span>
            <Slider
              value={[displayCurrentTime]}
              max={duration}
              step={1}
              onValueChange={handleSeekChange}
              onValueCommit={handleSeekCommit}
              className="flex-1"
              data-testid="slider-progress"
            />
            <span className="w-12 text-xs font-semibold text-white/60 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex w-full items-center justify-end gap-2 md:w-1/3 md:gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/lyrics")}
            className="h-9 w-9 rounded-full bg-white/5 text-foreground transition-colors hover:bg-white/15"
            data-testid="button-lyrics"
          >
            <Mic2 className="h-4 w-4" />
          </Button>

          {currentTrack.source === 'youtube' && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleVideoToggle}
              className="h-9 w-9 rounded-full bg-white/5 text-foreground transition-colors hover:bg-white/15"
              data-testid="button-audio-mode"
            >
              {audioOnlyMode ? (
                <VideoOff className="h-4 w-4" />
              ) : (
                <Video className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleFullscreen}
            className="h-9 w-9 rounded-full bg-white/5 text-foreground transition-colors hover:bg-white/15"
            data-testid="button-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowQueuePanel((prev) => !prev)}
            className="h-9 w-9 rounded-full bg-white/5 text-foreground transition-colors hover:bg-white/15"
            data-testid="button-queue"
          >
            <List className="h-4 w-4" />
          </Button>

          <div 
            className="relative"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <Button
              size="icon"
              variant="ghost"
              onClick={(event) => {
                if (!showVolumeSlider) {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowVolumeSlider(true);
                  return;
                }
                toggleMute();
              }}
              className="h-9 w-9 rounded-full bg-white/5 text-foreground transition-colors hover:bg-white/15"
              data-testid="button-volume"
            >
              {isMuted || volumeValue === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>

            {showVolumeSlider && (
              <div className="absolute bottom-full right-0 mb-2 w-44 rounded-2xl border border-white/10 bg-background/90 p-4 shadow-xl backdrop-blur">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Volume</p>
                <Slider
                  value={[isMuted ? 0 : volumeValue]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-full"
                  data-testid="slider-volume"
                />
              </div>
            )}
          </div>
        </div>
      </div>

        <AnimatePresence>
          {showQueuePanel && (
            <motion.div
              key="queue-panel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full left-0 right-0 mb-4 max-h-80 overflow-hidden rounded-3xl border border-white/10 bg-background/95 p-4 text-sm shadow-2xl backdrop-blur"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Queue
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full border border-transparent bg-white/10 px-3 text-white hover:bg-white/20"
                  onClick={() => setShowQueuePanel(false)}
                >
                  Close
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {queue.length ? (
                  queue.map((track: PlayerTrack, index: number) => (
                    <button
                      key={`${track.youtubeId ?? track.id ?? index}-${index}`}
                      onClick={() => handleQueueSelect(track)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-white/10",
                        track.youtubeId === currentTrack.youtubeId && "bg-white/10 border border-white/20",
                      )}
                    >
                      <img
                        src={track.thumbnail || "/placeholder.svg"}
                        alt={track.title}
                        className="h-10 w-10 flex-shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                        <p className="truncate text-xs text-white/70">{track.artist || "Unknown Artist"}</p>
                      </div>
                      <span className="text-xs text-white/50">{formatTime(track.duration ?? 0)}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Queue is empty.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
