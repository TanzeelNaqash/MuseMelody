import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Settings,
  Maximize2,
  Minimize2,
  Video,
  VideoOff,
  Loader2,
  SkipForward,
  SkipBack,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { VideoStream } from "@/lib/youtubeStream";

// Format quality label from stream
const formatQualityLabel = (stream: VideoStream): string => {
  if (stream.quality && stream.quality !== "unknown") {
    return stream.quality;
  }
  // Generate from height
  if (stream.height) {
    if (stream.height >= 4320) return "4320p (8K)";
    if (stream.height >= 2160) return "2160p (4K)";
    if (stream.height >= 1440) return "1440p (2K)";
    if (stream.height >= 1080) return "1080p";
    if (stream.height >= 720) return "720p";
    if (stream.height >= 480) return "480p";
    if (stream.height >= 360) return "360p";
    if (stream.height >= 240) return "240p";
    if (stream.height >= 144) return "144p";
    return `${stream.height}p`;
  }
  return "Auto";
};

interface VideoPlaybackProps {
  videoRef: (node: HTMLVideoElement | null) => void;
  manifestUrl?: string | null;
  videoStreams?: VideoStream[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  onVideoToggle?: () => void;
  audioOnlyMode?: boolean;
  thumbnail?: string | null;
  title?: string | null;
  artist?: string | null;
  className?: string;
  isMini?: boolean;
  isLoadingStream?: boolean;
}

export function VideoPlayback({
  videoRef,
  manifestUrl,
  videoStreams = [],
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreenToggle,
  isFullscreen = false,
  onVideoToggle,
  audioOnlyMode = false,
  thumbnail,
  title,
  artist,
  className,
  isMini = false,
  isLoadingStream = false,
}: VideoPlaybackProps) {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [hlsLevels, setHlsLevels] = useState<Array<{ height: number; width: number; bitrate: number }>>([]);
  const [isSeeking, setIsSeeking] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const isUserInteractingRef = useRef(false);

  // Assign video ref
  useEffect(() => {
    videoRef(videoElementRef.current);
  }, [videoRef]);

  // Format time helper
  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    if (isPlaying && !isMini) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, isMini]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  // Load video source
  useEffect(() => {
    const video = videoElementRef.current;
    if (!video) return;

    const cleanupHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    const loadVideo = async () => {
      cleanupHls();
      setIsLoading(true);

      try {
        // Prefer HLS manifest if available
        if (manifestUrl && Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
          });
          hlsRef.current = hls;

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error("HLS error:", data);
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  // Fallback to direct video stream
                  if (videoStreams.length > 0) {
                    loadDirectStream(videoStreams[0]);
                  } else {
                    setIsLoading(false);
                  }
                  break;
              }
            }
          });

          hls.loadSource(manifestUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            // Store HLS levels for quality selection
            if (hls.levels && hls.levels.length > 0) {
              setHlsLevels(hls.levels.map(level => ({
                height: level.height || 0,
                width: level.width || 0,
                bitrate: level.bitrate || 0,
              })));
            }
            // Set initial quality if available
            if (hls.levels.length > 0 && selectedQuality) {
              const qualityIndex = hls.levels.findIndex((level) => {
                const height = level.height;
                const qualityStr = selectedQuality.toLowerCase();
                if (qualityStr.includes('4320') || qualityStr.includes('8k')) return height >= 4320;
                if (qualityStr.includes('2160') || qualityStr.includes('4k')) return height >= 2160 && height < 4320;
                if (qualityStr.includes('1440') || qualityStr.includes('2k')) return height >= 1440 && height < 2160;
                if (qualityStr.includes('1080')) return height >= 1080 && height < 1440;
                if (qualityStr.includes('720')) return height >= 720 && height < 1080;
                if (qualityStr.includes('480')) return height >= 480 && height < 720;
                if (qualityStr.includes('360')) return height >= 360 && height < 480;
                if (qualityStr.includes('240')) return height >= 240 && height < 360;
                if (qualityStr.includes('144')) return height >= 144 && height < 240;
                return false;
              });
              if (qualityIndex >= 0) {
                hls.currentLevel = qualityIndex;
              }
            }
          });

          hls.on(Hls.Events.LEVEL_LOADED, () => {
            setIsLoading(false);
          });
        } else if (manifestUrl && video.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS support (Safari)
          video.src = manifestUrl;
          video.load();
          video.addEventListener('loadedmetadata', () => setIsLoading(false), { once: true });
        } else if (videoStreams.length > 0) {
          // Fallback to direct video stream
          const streamToUse = selectedQuality
            ? videoStreams.find((s) => s.quality === selectedQuality) || videoStreams[0]
            : videoStreams[0];
          loadDirectStream(streamToUse);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading video:", error);
        setIsLoading(false);
      }
    };

    const loadDirectStream = (stream: VideoStream) => {
      const url = stream.proxiedUrl || stream.url;
      if (url) {
        video.src = url;
        video.load();
        video.addEventListener('loadedmetadata', () => setIsLoading(false), { once: true });
        video.addEventListener('canplay', () => setIsLoading(false), { once: true });
      }
    };

    if (!audioOnlyMode && (manifestUrl || videoStreams.length > 0)) {
      loadVideo();
    }

    return cleanupHls;
  }, [manifestUrl, videoStreams, selectedQuality, audioOnlyMode]);

  // Sync playback state - don't auto-play, respect isPlaying
  useEffect(() => {
    const video = videoElementRef.current;
    if (!video || isLoading || isLoadingStream) return;

    // Only sync playback if user is not interacting
    if (!isUserInteractingRef.current) {
      if (isPlaying && video.paused) {
        video.play().catch((err) => {
          console.error("Play error:", err);
        });
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    }
  }, [isPlaying, isLoading, isLoadingStream]);

  // Handle seek from parent (only when not user-interacting)
  useEffect(() => {
    const video = videoElementRef.current;
    if (!video || isSeeking || isUserInteractingRef.current) return;

    // Only sync if there's a significant difference (more than 1 second)
    const timeDiff = Math.abs(video.currentTime - currentTime);
    if (timeDiff > 1) {
      video.currentTime = currentTime;
    }
  }, [currentTime, isSeeking]);

  // Sync volume and ensure audio is enabled
  useEffect(() => {
    const video = videoElementRef.current;
    if (!video) return;
    // Normalize volume to 0-1 range
    const normalizedVolume = volume > 1 ? volume / 100 : volume;
    video.volume = Math.max(0, Math.min(1, normalizedVolume));
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Listen to video time updates and sync with parent (but don't force sync back)
  useEffect(() => {
    const video = videoElementRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      // Only update if user is not seeking
      if (!isSeeking && !isUserInteractingRef.current) {
        const currentVideoTime = Math.floor(video.currentTime);
        const parentTime = Math.floor(currentTime);
        // Only update if there's a significant difference
        if (Math.abs(currentVideoTime - parentTime) > 1) {
          // Let parent know about the time update
          // This will be handled by AudioEngine's video listeners
        }
      }
    };

    const handleLoadedMetadata = () => {
      // Ensure audio is enabled
      if (video && !isMuted) {
        video.muted = false;
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [isSeeking, isMuted, currentTime]);

  const displayTime = scrubTime ?? currentTime;
  const normalizedVolume = volume > 1 ? volume / 100 : volume;

  const handleSeekChange = (value: number[]) => {
    setScrubTime(value[0]);
    setIsSeeking(true);
    isUserInteractingRef.current = true;
  };

  const handleSeekCommit = (value: number[]) => {
    const seekTime = value[0];
    setScrubTime(null);
    setIsSeeking(false);
    isUserInteractingRef.current = false;
    
    const video = videoElementRef.current;
    if (video) {
      video.currentTime = seekTime;
      // Continue playing if it was playing before
      if (isPlaying) {
        video.play().catch(console.error);
      }
    }
    onSeek(seekTime);
  };

  const handleVolumeChange = (value: number[]) => {
    // Slider value is 0-100, convert to 0-1 range
    onVolumeChange(value[0] / 100);
  };

  const handleQualitySelect = (quality: string) => {
    setSelectedQuality(quality);
    const video = videoElementRef.current;
    
    // If using HLS, switch quality using HLS.js API
    if (hlsRef.current && manifestUrl) {
      const hls = hlsRef.current;
      if (hls.levels && hls.levels.length > 0) {
        const qualityIndex = hls.levels.findIndex((level) => {
          const height = level.height;
          const qualityStr = quality.toLowerCase();
          if (qualityStr.includes('4320') || qualityStr.includes('8k')) return height >= 4320;
          if (qualityStr.includes('2160') || qualityStr.includes('4k')) return height >= 2160 && height < 4320;
          if (qualityStr.includes('1440') || qualityStr.includes('2k')) return height >= 1440 && height < 2160;
          if (qualityStr.includes('1080')) return height >= 1080 && height < 1440;
          if (qualityStr.includes('720')) return height >= 720 && height < 1080;
          if (qualityStr.includes('480')) return height >= 480 && height < 720;
          if (qualityStr.includes('360')) return height >= 360 && height < 480;
          if (qualityStr.includes('240')) return height >= 240 && height < 360;
          if (qualityStr.includes('144')) return height >= 144 && height < 240;
          return false;
        });
        if (qualityIndex >= 0) {
          hls.currentLevel = qualityIndex;
          return;
        }
      }
    }
    
    // Fallback to direct video stream for non-HLS
    if (video && videoStreams.length > 0) {
      const stream = videoStreams.find((s) => {
        const label = formatQualityLabel(s);
        return s.quality === quality || label === quality;
      });
      if (stream) {
        const wasPlaying = !video.paused;
        const currentTime = video.currentTime;
        const url = stream.proxiedUrl || stream.url;
        if (url) {
          video.src = url;
          video.currentTime = currentTime;
          video.load();
          if (wasPlaying) {
            video.play().catch(console.error);
          }
        }
      }
    }
  };

  const handleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error("Error exiting fullscreen:", err);
      });
    }

    if (onFullscreenToggle) {
      onFullscreenToggle();
    }
  };

  const handleSkip = (seconds: number) => {
    const video = videoElementRef.current;
    if (!video) return;
    
    const newTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
    video.currentTime = newTime;
    onSeek(newTime);
    
    // Continue playing if it was playing
    if (isPlaying && video.paused) {
      video.play().catch(console.error);
    }
  };

  const handlePlayPause = () => {
    isUserInteractingRef.current = true;
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
    setTimeout(() => {
      isUserInteractingRef.current = false;
    }, 100);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-black",
        isMini ? "aspect-video" : "aspect-video",
        className
      )}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => {
        if (isPlaying && !isMini) {
          setShowControls(false);
        }
      }}
    >
      {audioOnlyMode ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title ?? "thumbnail"}
              className="h-full w-full object-cover opacity-50"
            />
          ) : (
            <div className="text-sm text-muted-foreground">Video disabled</div>
          )}
        </div>
      ) : (
        <>
          <video
            ref={videoElementRef}
            className="h-full w-full object-contain"
            playsInline
            muted={isMuted}
            onClick={handlePlayPause}
          />
          {(isLoading || isLoadingStream) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {/* Controls Overlay */}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300",
              showControls || isMini ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            {/* Top Controls */}
            {!isMini && (
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h3 className="truncate text-sm font-medium text-white">{title}</h3>
                  )}
                  {artist && (
                    <p className="truncate text-xs text-white/70">{artist}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {onVideoToggle && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={onVideoToggle}
                      className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                    >
                      {audioOnlyMode ? (
                        <VideoOff className="h-4 w-4" />
                      ) : (
                        <Video className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {(videoStreams.length > 0 || hlsLevels.length > 0) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {/* Show HLS levels if available, otherwise show video streams */}
                        {hlsLevels.length > 0 ? (
                          hlsLevels.map((level, index) => {
                            const qualityLabel = level.height >= 4320 ? '4320p (8K)' :
                              level.height >= 2160 ? '2160p (4K)' :
                              level.height >= 1440 ? '1440p (2K)' :
                              level.height >= 1080 ? '1080p' :
                              level.height >= 720 ? '720p' :
                              level.height >= 480 ? '480p' :
                              level.height >= 360 ? '360p' :
                              level.height >= 240 ? '240p' :
                              level.height >= 144 ? '144p' : `${level.height}p`;
                            return (
                              <DropdownMenuItem
                                key={`hls-${index}-${level.height}`}
                                onClick={() => {
                                  if (hlsRef.current) {
                                    hlsRef.current.currentLevel = index;
                                    setSelectedQuality(qualityLabel);
                                  }
                                }}
                                className={cn(
                                  "cursor-pointer",
                                  selectedQuality === qualityLabel && "bg-primary/10"
                                )}
                              >
                                {qualityLabel}
                              </DropdownMenuItem>
                            );
                          })
                        ) : (
                          videoStreams.map((stream, index) => {
                            const qualityLabel = formatQualityLabel(stream);
                            return (
                            <DropdownMenuItem
                                key={stream.quality || stream.height || index}
                                onClick={() => handleQualitySelect(qualityLabel)}
                              className={cn(
                                "cursor-pointer",
                                  (selectedQuality === stream.quality || selectedQuality === qualityLabel) && "bg-primary/10"
                              )}
                            >
                                {qualityLabel}
                            </DropdownMenuItem>
                            );
                          })
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleFullscreen}
                    className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                  >
                    {isFullscreen || document.fullscreenElement ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Center Play/Pause Button */}
            {!isMini && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handlePlayPause}
                  className="h-16 w-16 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="h-8 w-8 ml-1" />
                  )}
                </Button>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
              {/* Progress Bar */}
              <div className="mb-3">
                <Slider
                  value={[displayTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeekChange}
                  onValueCommit={handleSeekCommit}
                  className="w-full"
                />
              </div>

              {/* Control Bar */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Rewind Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleSkip(-10)}
                  className="h-8 w-8 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20"
                  title="Rewind 10s"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handlePlayPause}
                  className="h-8 w-8 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </Button>

                {/* Fast Forward Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleSkip(10)}
                  className="h-8 w-8 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20"
                  title="Forward 10s"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>

                {/* Time Display */}
                <div className="text-xs text-white/90 font-mono shrink-0">
                  {formatTime(displayTime)} / {formatTime(duration)}
                </div>

                {/* Volume Control */}
                <div className="flex items-center gap-2 flex-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onMuteToggle}
                    className="h-8 w-8 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20"
                  >
                    {isMuted || normalizedVolume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Slider
                    value={[normalizedVolume * 100]}
                    max={100}
                    step={1}
                    onValueChange={handleVolumeChange}
                    className="w-20 sm:w-24"
                  />
                </div>

                {/* Mini Mode: Video Toggle */}
                {isMini && onVideoToggle && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onVideoToggle}
                    className="h-8 w-8 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20"
                  >
                    {audioOnlyMode ? (
                      <VideoOff className="h-4 w-4" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
