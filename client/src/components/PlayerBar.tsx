import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, Shuffle, List, Mic2, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayerStore } from "@/lib/playerStore";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "wouter";

export function PlayerBar() {
  const [, navigate] = useRouter();
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    isRepeat,
    isShuffle,
    currentTime,
    duration,
    audioOnlyMode,
    showLyrics,
    togglePlay,
    playNext,
    playPrevious,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    setCurrentTime,
    toggleAudioOnlyMode,
    toggleLyrics,
  } = usePlayerStore();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  if (!currentTrack) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-card border-t border-card-border z-50">
      <div className="h-full px-4 flex items-center gap-4">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-64 min-w-0">
          <img
            src={currentTrack.thumbnail || '/placeholder.svg'}
            alt={currentTrack.title}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate" data-testid="text-current-track-title">
              {currentTrack.title}
            </p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-current-track-artist">
              {currentTrack.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex-1 flex flex-col items-center gap-2 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleShuffle}
              className={cn("h-8 w-8", isShuffle && "text-primary")}
              data-testid="button-shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={playPrevious}
              className="h-9 w-9"
              data-testid="button-previous"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              onClick={togglePlay}
              className="h-10 w-10 bg-primary hover:bg-primary/90"
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" fill="currentColor" />
              ) : (
                <Play className="h-5 w-5" fill="currentColor" />
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={playNext}
              className="h-9 w-9"
              data-testid="button-next"
            >
              <SkipForward className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={toggleRepeat}
              className={cn("h-8 w-8", isRepeat && "text-primary")}
              data-testid="button-repeat"
            >
              <Repeat className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="w-full flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={duration}
              step={1}
              onValueChange={handleSeek}
              className="flex-1"
              data-testid="slider-progress"
            />
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 w-64 justify-end">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/lyrics")}
            className={cn("h-9 w-9")}
            data-testid="button-lyrics"
          >
            <Mic2 className="h-4 w-4" />
          </Button>

          {currentTrack.source === 'youtube' && (
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleAudioOnlyMode}
              className="h-9 w-9"
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
            onClick={() => navigate("/queue")}
            className="h-9 w-9"
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
              onClick={toggleMute}
              className="h-9 w-9"
              data-testid="button-volume"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>

            {showVolumeSlider && (
              <div className="absolute bottom-full right-0 mb-2 p-3 bg-popover border border-popover-border rounded-lg shadow-xl">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  orientation="vertical"
                  className="h-24"
                  data-testid="slider-volume"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
