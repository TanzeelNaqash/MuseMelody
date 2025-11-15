import { useEffect, useRef, useState } from "react";
import { usePlayerStore, type PlayerStoreState } from "@/lib/playerStore";
import { useShallow } from "zustand/react/shallow";
import type { Track as PlayerTrack } from "@/lib/playerStore";
import { getBestAudioStreamUrl, type ResolvedStream } from "@/lib/youtubeStream";
import { motion, AnimatePresence } from "framer-motion";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@shared/schema";
import { VideoModal } from "@/components/VideoModal";
import { useToast } from "@/hooks/use-toast";
import { VPNNotification } from "@/components/VPNNotification";

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const streamInfoRef = useRef<ResolvedStream | null>(null);
  const activeSourceRef = useRef<"audio" | "video">("audio");
  const fadeFrameRef = useRef<number | null>(null);
  const detachVideoListenersRef = useRef<(() => void) | null>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [showVPNNotification, setShowVPNNotification] = useState(false);
  const [vpnNotificationMessage, setVpnNotificationMessage] = useState<string | undefined>();
  const { toast } = useToast();
  const storeSlice = usePlayerStore(
    useShallow((state: PlayerStoreState) => ({
      currentTrack: state.currentTrack,
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      duration: state.duration,
      volume: state.volume,
      isMuted: state.isMuted,
      setDuration: state.setDuration,
      setCurrentTime: state.setCurrentTime,
      setIsPlaying: state.setIsPlaying,
      playNext: state.playNext,
      playPrevious: state.playPrevious,
      togglePlay: state.togglePlay,
      toggleShuffle: state.toggleShuffle,
      toggleRepeat: state.toggleRepeat,
      setVolume: state.setVolume,
      toggleMute: state.toggleMute,
      audioOnlyMode: state.audioOnlyMode,
      setAudioOnlyMode: state.setAudioOnlyMode,
      videoModalOpen: state.videoModalOpen,
      setVideoModalOpen: state.setVideoModalOpen,
      setAudioElement: state.setAudioElement,
      setVideoElement: state.setVideoElement,
      pendingSeek: state.pendingSeek,
      clearPendingSeek: state.clearPendingSeek,
      isFullscreen: state.isFullscreen,
      toggleFullscreen: state.toggleFullscreen,
      isShuffle: state.isShuffle,
      isRepeat: state.isRepeat,
      requestSeek: state.requestSeek,
      queue: state.queue,
      setCurrentTrack: state.setCurrentTrack,
      setIsLoadingStream: state.setIsLoadingStream,
    })),
  );

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    playNext,
    playPrevious,
    togglePlay,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    toggleMute,
    audioOnlyMode,
    setAudioOnlyMode,
    videoModalOpen,
    setVideoModalOpen,
    setAudioElement,
    setVideoElement,
    pendingSeek,
    clearPendingSeek,
    isFullscreen,
    toggleFullscreen,
    isShuffle,
    isRepeat,
    requestSeek,
    queue,
    setCurrentTrack,
    setIsLoadingStream,
  } = storeSlice;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const displayCurrentTime = currentTime;
  const normalizeVolumeValue = (value: number | string) => {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return numeric > 1 ? numeric / 100 : numeric;
  };
  const normalizedVolume = normalizeVolumeValue(volume);
  const [fullscreenScrub, setFullscreenScrub] = useState<number | null>(null);
  const fullscreenDisplayTime = fullscreenScrub ?? currentTime;
  const [fullscreenPanel, setFullscreenPanel] = useState<"info" | "lyrics" | "queue">("info");
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const canShowLyrics = Boolean(currentTrack?.title && currentTrack?.artist);

  useEffect(() => {
    if (!isFullscreen) {
      setFullscreenPanel("info");
    }
  }, [isFullscreen]);

  useEffect(() => {
    setLyrics(null);
    setLyricsError(null);
    setLyricsLoading(false);
  }, [currentTrack?.youtubeId]);

  useEffect(() => {
    if (!isFullscreen || fullscreenPanel !== "lyrics") return;
    if (!canShowLyrics) {
      setLyrics(null);
      setLyricsError("Lyrics unavailable for this track.");
      return;
    }

    const controller = new AbortController();
    const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";
    setLyricsLoading(true);
    setLyricsError(null);

    fetch(
      `${API_URL}/api/lyrics?title=${encodeURIComponent(currentTrack!.title!)}&artist=${encodeURIComponent(
        currentTrack!.artist!,
      )}`,
      {
        signal: controller.signal,
        credentials: "include",
      },
    )
      .then((res) => (res.ok ? res.json() : { lyrics: null }))
      .then((data) => {
        if (controller.signal.aborted) return;
        const text = data?.lyrics ?? null;
        setLyrics(text);
        if (!text) {
          setLyricsError("Lyrics not available.");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load lyrics:", error);
        setLyricsError("Unable to load lyrics.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLyricsLoading(false);
        }
      });

    return () => controller.abort();
  }, [isFullscreen, fullscreenPanel, canShowLyrics, currentTrack?.title, currentTrack?.artist]);

  const normalizeVolume = (value: number | string) => {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return 1;
    const scaled = numeric > 1 ? numeric / 100 : numeric;
    return Math.max(0, Math.min(1, scaled));
  };

  const getActiveMediaElement = () => {
    if (!audioOnlyMode && activeSourceRef.current === "video" && videoRef.current) {
      return videoRef.current;
    }
    return audioRef.current;
  };

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
      audioRef.current.crossOrigin = "anonymous";
    }
    const audio = audioRef.current;
    if (audio) {
      setAudioElement(audio);
    }

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(Math.floor(audio.duration));
      }
    };
    const onCanPlay = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(Math.floor(audio.duration));
      }
    };
    const onTimeUpdate = () => setCurrentTime(Math.floor(audio.currentTime));
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const { isRepeat, currentTrack } = usePlayerStore.getState();
      // If repeat is enabled, replay the current track
      if (isRepeat && currentTrack) {
        setCurrentTime(0);
        requestSeek(0);
        return;
      }
      // Otherwise, play next (which handles shuffle)
      playNext();
    };
    const onError = (e: Event) => {
      console.error("Audio element error:", e);
      const audioElement = e.target as HTMLAudioElement;
      const error = audioElement.error;
      
      if (error) {
        // Check if it's a network/access error (403, CORS, etc.)
        if (error.code === MediaError.MEDIA_ERR_NETWORK || error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          // Check if the source URL contains googlevideo (likely a 403)
          const src = audioElement.src;
          if (src && (src.includes('googlevideo.com') || src.includes('/api/streams') || src.includes('/proxy'))) {
            setVpnNotificationMessage("Unable to access stream. This might be due to regional restrictions or access limitations.");
            setShowVPNNotification(true);
          }
        }
      }
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      setAudioElement(null);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playNext, setAudioElement, setCurrentTime, setDuration, setIsPlaying, requestSeek]);

  const attachVideoListeners = (video: HTMLVideoElement) => {
    const onLoadedMetadata = () => {
      if (Number.isFinite(video.duration)) {
        setDuration(Math.floor(video.duration));
      }
    };
    const onTimeUpdate = () => setCurrentTime(Math.floor(video.currentTime));
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      if (!video.paused) return;
      setIsPlaying(false);
    };
    const onEnded = () => {
      const { isRepeat, currentTrack } = usePlayerStore.getState();
      // If repeat is enabled, replay the current track
      if (isRepeat && currentTrack) {
        setCurrentTime(0);
        requestSeek(0);
        return;
      }
      // Otherwise, play next (which handles shuffle)
      playNext();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    detachVideoListenersRef.current = () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  };

  const assignVideoRef = (node: HTMLVideoElement | null) => {
    if (videoRef.current && detachVideoListenersRef.current) {
      detachVideoListenersRef.current();
      detachVideoListenersRef.current = null;
    }

    videoRef.current = node;

    if (node) {
      setVideoElement(node);
      attachVideoListeners(node);
    } else {
      setVideoElement(null);
    }
  };

  useEffect(() => {
    return () => {
      if (detachVideoListenersRef.current) {
        detachVideoListenersRef.current();
        detachVideoListenersRef.current = null;
      }
      setVideoElement(null);
    };
  }, [setVideoElement]);

  // Load source for current track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;

    const cleanupHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    const cleanupVideo = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute("src");
        videoEl.load();
      }
      setIsVideoActive(false);
    };

    const cancelFade = () => {
      if (fadeFrameRef.current != null) {
        cancelAnimationFrame(fadeFrameRef.current);
        fadeFrameRef.current = null;
      }
    };

    const applyVolume = () => {
      cancelFade();
      audio.muted = isMuted;
      audio.volume = normalizeVolume(volume);
    };

    const applyVideoVolume = () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      videoEl.muted = isMuted;
      videoEl.volume = normalizeVolume(volume);
    };

    const fallbackToDirect = async (forceReload = false) => {
      const info = streamInfoRef.current;
      cleanupHls();
      if (!info) return;

      const directUrl = info.proxiedUrl ?? info.rawUrl ?? info.url;
      if (!directUrl) return;

      if (forceReload || audio.src !== directUrl) {
        audio.src = directUrl;
        audio.load();
      }

      applyVolume();
      if (isPlaying) {
        try {
          await audio.play();
        } catch {
          // autoplay restriction
        }
      }
    };

    const attachVideoStream = async (manifestUrl: string | null | undefined, directUrl?: string | null) => {
      const videoEl = videoRef.current;
      if (!videoEl) return false;
      if (!manifestUrl && !directUrl) return false;

      cleanupHls();

      if (manifestUrl && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, async (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                cleanupVideo();
                await fallbackToDirect(true);
                break;
            }
          }
        });
        hls.attachMedia(videoEl);
        hls.loadSource(manifestUrl);
        activeSourceRef.current = "video";
        setIsVideoActive(true);
        applyVideoVolume();
        if (isPlaying) {
          try {
            await videoEl.play();
          } catch {
            // autoplay restriction
          }
        }
        return true;
      }

      if (manifestUrl && videoEl.canPlayType("application/vnd.apple.mpegurl")) {
        if (videoEl.src !== manifestUrl) {
          videoEl.src = manifestUrl;
          videoEl.load();
        }
        activeSourceRef.current = "video";
        setIsVideoActive(true);
        applyVideoVolume();
        if (isPlaying) {
          try {
            await videoEl.play();
          } catch {
            // ignore autoplay restrictions
          }
        }
        return true;
      }

      if (directUrl) {
        videoEl.src = directUrl;
        videoEl.load();
        activeSourceRef.current = "video";
        setIsVideoActive(true);
        applyVideoVolume();
        if (isPlaying) {
          try {
            await videoEl.play();
          } catch {
            // ignore autoplay restrictions
          }
        }
        return true;
      }

      return false;
    };

    const run = async () => {
      if (!currentTrack) {
        cleanupHls();
        cleanupVideo();
        cancelFade();
        audio.removeAttribute("src");
        streamInfoRef.current = null;
        return;
      }

      cleanupHls();
      cleanupVideo();
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
      setCurrentTime(0);
      setDuration(0);

      if (currentTrack.source === "youtube" && currentTrack.youtubeId) {
        try {
          setIsLoadingStream(true);
          const info = await getBestAudioStreamUrl(currentTrack.youtubeId);
          if (cancelled) {
            setIsLoadingStream(false);
            return;
          }
          setIsLoadingStream(false);
          if (!info) {
            console.error("No stream available for track", currentTrack.youtubeId);
            setVpnNotificationMessage("Unable to load stream. All streaming sources failed. This might be due to regional restrictions.");
            setShowVPNNotification(true);
            toast({
              title: "Stream unavailable",
              description: "Unable to load stream. Please try again later or try switching location using VPN.",
              variant: "destructive",
            });
            audio.pause();
            audio.currentTime = 0;
            audio.removeAttribute("src");
            audio.load();
            setDuration(0);
            setCurrentTime(0);
            if (queue.length > 1) {
              playNext();
            } else {
              setIsPlaying(false);
            }
            return;
          }
          streamInfoRef.current = info;

          const directUrl = info.proxiedUrl ?? info.rawUrl ?? info.url;

          if (!audioOnlyMode && (info.manifestUrl || directUrl)) {
            const attached = await attachVideoStream(info.manifestUrl, directUrl);
            if (attached) {
              audio.pause();
              audio.src = directUrl ?? "";
              return;
            }
          }

          cleanupVideo();
          activeSourceRef.current = "audio";

          if (info.manifestUrl) {
            if (Hls.isSupported()) {
              cleanupHls();
              const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 60,
              });
              hlsRef.current = hls;
              hls.on(Hls.Events.ERROR, async (_event, data) => {
                if (data.fatal) {
                  console.error("HLS fatal error", data);
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      hls.startLoad();
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      hls.recoverMediaError();
                      break;
                    default:
                      await fallbackToDirect(true);
                      break;
                  }
                }
              });
              hls.attachMedia(audio);
              hls.loadSource(info.manifestUrl);
            } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
              cleanupHls();
              if (audio.src !== info.manifestUrl) {
                audio.src = info.manifestUrl;
                audio.load();
              }
            } else {
              await fallbackToDirect(true);
            }
          } else {
            await fallbackToDirect(true);
          }
        } catch (error) {
          console.error("Failed to resolve audio stream:", error);
          setIsLoadingStream(false);
          
          // Check if it's a 403 or network error
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('Access denied')) {
            setVpnNotificationMessage("Access denied by video provider. This might be due to regional restrictions or IP blocking.");
            setShowVPNNotification(true);
          } else {
            setVpnNotificationMessage("Unable to load stream. Please try again later or try switching location using VPN.");
            setShowVPNNotification(true);
          }
          
          toast({
            title: "Stream unavailable",
            description: "Unable to load stream. Please try again later or try switching location using VPN.",
            variant: "destructive",
          });
          await fallbackToDirect(true);
          if (!streamInfoRef.current && queue.length > 1) {
            playNext();
            return;
          }
          if (!streamInfoRef.current) {
            setIsPlaying(false);
          }
        }
      } else if (currentTrack.source === "local" && currentTrack.fileUrl) {
        cleanupHls();
        cleanupVideo();
        streamInfoRef.current = {
          url: currentTrack.fileUrl,
        };
        if (audio.src !== currentTrack.fileUrl) {
          audio.src = currentTrack.fileUrl;
          audio.load();
        }
        activeSourceRef.current = "audio";
        setIsVideoActive(false);
      }

      const media = getActiveMediaElement();

      if (media) {
        const shouldFadeIn = isPlaying && !isMuted && media === audio;
        if (media === audio) {
      applyVolume();
        } else {
          applyVideoVolume();
        }

      if (shouldFadeIn) {
        const targetVolume = normalizeVolume(volume);
        audio.volume = 0;
        const fadeDuration = 800;
        const start = performance.now();
        const tick = () => {
          const elapsed = performance.now() - start;
          const progress = Math.min(1, elapsed / fadeDuration);
          audio.volume = targetVolume * progress;
          if (progress < 1) {
            fadeFrameRef.current = requestAnimationFrame(tick);
          } else {
            fadeFrameRef.current = null;
          }
        };
        fadeFrameRef.current = requestAnimationFrame(tick);
        }
      }

      if (isPlaying) {
        try {
          await getActiveMediaElement()?.play();
        } catch {
          // ignore autoplay restrictions
        }
      } else {
        getActiveMediaElement()?.pause();
      }
    };

    run();

    return () => {
      cancelled = true;
      cancelFade();
      cleanupHls();
      cleanupVideo();
    };
  }, [audioOnlyMode, currentTrack, queue, playNext, setCurrentTime, setDuration, setIsPlaying]);

  // React to play/pause changes
  useEffect(() => {
    const media = getActiveMediaElement();
    if (!media) return;
    if (isPlaying) {
      media.play().catch(() => {});
    } else {
      media.pause();
    }
  }, [isPlaying, audioOnlyMode]);

  // React to volume/mute
  useEffect(() => {
    const media = getActiveMediaElement();
    if (!media) return;
    media.muted = isMuted;
    media.volume = normalizeVolume(volume);
  }, [audioOnlyMode, isMuted, volume]);

  // Handle pending seek requests
  useEffect(() => {
    if (pendingSeek == null) return;
    const media = getActiveMediaElement();
    if (!media) {
      clearPendingSeek();
      return;
    }
    if (Number.isFinite(pendingSeek)) {
      media.currentTime = pendingSeek;
      setCurrentTime(Math.floor(media.currentTime));
    }
    clearPendingSeek();
  }, [clearPendingSeek, pendingSeek, setCurrentTime]);

  const fullscreenSliderMax = Math.max(duration || 0, fullscreenDisplayTime || 0, 1);

  const handleFullscreenSeekChange = (value: number[]) => {
    setFullscreenScrub(value[0]);
  };

  const handleFullscreenSeekCommit = (value: number[]) => {
    setFullscreenScrub(null);
    requestSeek(value[0]);
  };

  const handleFullscreenVolumeChange = (value: number[]) => {
    const next = value[0];
    if (Math.abs(next - normalizedVolume) < 0.0001) return;
    setVolume(next);
  };

  const handleSelectQueueTrack = (track: PlayerTrack) => {
    setCurrentTrack(track);
    requestSeek(0);
    setFullscreenPanel("info");
  };

  const renderFullscreenPanel = () => {
    if (fullscreenPanel === "lyrics") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">Lyrics</p>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full border border-transparent bg-white/10 px-3 text-white hover:bg-white/20"
              onClick={() => setFullscreenPanel("info")}
            >
              Close
            </Button>
          </div>
          {lyricsLoading ? (
            <p className="text-sm text-white/70">Loading lyrics…</p>
          ) : lyricsError ? (
            <p className="text-sm text-white/70">{lyricsError}</p>
          ) : (
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-white/80">
              {lyrics ?? "Lyrics not available."}
            </div>
          )}
        </div>
      );
    }

    if (fullscreenPanel === "queue") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">Queue</p>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full border border-transparent bg-white/10 px-3 text-white hover:bg-white/20"
              onClick={() => setFullscreenPanel("info")}
            >
              Close
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-white/10">
            {queue.length ? (
              queue.map((track: PlayerTrack, index: number) => (
                <button
                  key={`${track.id ?? track.youtubeId ?? index}-${index}`}
                  onClick={() => handleSelectQueueTrack(track)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/10",
                    track.youtubeId === currentTrack?.youtubeId && "bg-white/10 border border-white/20",
                  )}
                >
                  <img
                    src={track.thumbnail || "/placeholder.svg"}
                    alt={track.title}
                    className="h-12 w-12 flex-shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                    <p className="truncate text-xs text-white/60">{track.artist || "Unknown Artist"}</p>
                  </div>
                  <span className="text-xs text-white/50">{formatTime(track.duration ?? 0)}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-white/70">Queue is empty.</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-white/60">Now Playing</p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
          {currentTrack?.title}
        </h1>
        <p className="text-sm text-white/70 sm:text-base">{currentTrack?.artist || "Unknown Artist"}</p>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isFullscreen ? (
        <motion.div
          key="fullscreen-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.35),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.32),transparent_55%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))] backdrop-blur-2xl"
        >
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05]" />
          <div className="absolute top-4 right-4 z-20">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full border border-white/20 bg-white/10 px-4 text-white shadow-lg backdrop-blur hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              Exit Fullscreen
            </Button>
          </div>
          <div className="relative z-10 flex h-full w-full flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-center lg:gap-10 lg:px-12">
            <div className="mx-auto w/full max-w-3xl flex-1 overflow-hidden rounded-[32px] border border-white/15 bg-black/40 shadow-2xl">
              {!audioOnlyMode && isVideoActive && (!videoModalOpen || isFullscreen) ? (
                <video
                  ref={assignVideoRef}
                  className="aspect-video w-full object-cover"
                  playsInline
                  muted={isMuted}
                />
              ) : (
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black/30 sm:aspect-[4/3]">
                  <img
                    src={currentTrack?.thumbnail || "/placeholder.svg"}
                    alt={currentTrack?.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/60" />
                </div>
              )}
            </div>

            <div className="mx-auto w-full max-w-xl flex flex-col gap-5 rounded-[32px] border border-white/10 bg-white/5 p-6 text-white shadow-xl backdrop-blur-xl sm:p-8">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (audioOnlyMode) {
                      setAudioOnlyMode(false);
                      if (!isFullscreen) {
                        setVideoModalOpen(true);
                      }
                    } else {
                      setAudioOnlyMode(true);
                      setVideoModalOpen(false);
                    }
                    setFullscreenPanel("info");
                  }}
                  className="rounded-full border border-white/15 bg-white/10 px-4 text-white hover:bg-white/20"
                >
                  {audioOnlyMode ? "Enable Video" : "Audio Only"}
                </Button>
                {!audioOnlyMode && !videoModalOpen && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setVideoModalOpen(true)}
                    className="rounded-full border border-white/15 bg-white/10 px-4 text-white hover:bg-white/20"
                  >
                    Open Video Modal
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "rounded-full border border-transparent bg-white/10 px-4 text-white hover:bg-white/20",
                    fullscreenPanel === "info" && "border-white/40 bg-white/20",
                  )}
                  onClick={() => setFullscreenPanel("info")}
                >
                  Info
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canShowLyrics}
                  className={cn(
                    "rounded-full border border-transparent bg-white/10 px-4 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40",
                    fullscreenPanel === "lyrics" && "border-white/40 bg-white/20",
                  )}
                  onClick={() => setFullscreenPanel("lyrics")}
                >
                  Lyrics
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "rounded-full border border-transparent bg-white/10 px-4 text-white hover:bg-white/20",
                    fullscreenPanel === "queue" && "border-white/40 bg-white/20",
                  )}
                  onClick={() => setFullscreenPanel("queue")}
                >
                  Queue
                </Button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                {renderFullscreenPanel()}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-xs font-semibold text-white/60 sm:text-sm">
                  <span className="w-14 text-right">{formatTime(fullscreenDisplayTime)}</span>
                  <Slider
                    value={[fullscreenDisplayTime]}
                    max={fullscreenSliderMax}
                    step={1}
                    onValueChange={handleFullscreenSeekChange}
                    onValueCommit={handleFullscreenSeekCommit}
                    className="flex-1"
                  />
                  <span className="w-14 text-left">{formatTime(duration)}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleShuffle}
                      className={cn(
                        "h-10 w-10 rounded-full bg-white/10 text-white transition hover:bg-white/20",
                        isShuffle && "bg-primary/20 text-primary border border-primary/30",
                      )}
                    >
                      <Shuffle className="h-5 w-5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={playPrevious}
                      className="h-12 w-12 rounded-full bg-white/15 text-white transition hover:bg-white/25"
                    >
                      <SkipBack className="h-6 w-6" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={togglePlay}
                      className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/70 text-white shadow-lg shadow-primary/40 transition hover:scale-105"
                    >
                      {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={playNext}
                      className="h-12 w-12 rounded-full bg-white/15 text-white transition hover:bg-white/25"
                    >
                      <SkipForward className="h-6 w-6" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleRepeat}
                      className={cn(
                        "h-10 w-10 rounded-full bg-white/10 text-white transition hover:bg-white/20",
                        isRepeat && "bg-primary/20 text-primary border border-primary/30",
                      )}
                    >
                      <Repeat className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleMute}
                      className="h-10 w-10 rounded-full bg-white/10 text-white transition hover:bg-white/20"
                    >
                      {isMuted || normalizedVolume === 0 ? (
                        <VolumeX className="h-5 w-5" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )}
                    </Button>
                    <div className="hidden w-32 sm:block">
                      <Slider
                        value={[isMuted ? 0 : normalizedVolume]}
                        max={1}
                        step={0.01}
                        onValueChange={handleFullscreenVolumeChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                  {currentTrack?.source === "youtube" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (audioOnlyMode) {
                            setAudioOnlyMode(false);
                            if (!isFullscreen) {
                              setVideoModalOpen(true);
                            }
                          } else {
                            setAudioOnlyMode(true);
                            setVideoModalOpen(false);
                          }
                          setFullscreenPanel("info");
                        }}
                        className="rounded-full border border-white/15 bg-white/10 px-4 text-white hover:bg-white/20"
                      >
                        {audioOnlyMode ? "Enable Video" : "Audio Only"}
                      </Button>
                      {!audioOnlyMode && !videoModalOpen && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setVideoModalOpen(true)}
                          className="rounded-full border border-white/15 bg-white/10 px-4 text-white hover:bg-white/20"
                        >
                          Open Video Modal
                        </Button>
                      )}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full border border-white/15 bg-white/10 px-4 text-white hover:bg-white/20"
                    onClick={toggleFullscreen}
                  >
                    Exit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}

      <VideoModal
        open={videoModalOpen && !audioOnlyMode && !isFullscreen}
        onOpenChange={(open) => {
          if (open) {
            if (audioOnlyMode) {
              setAudioOnlyMode(false);
            }
            if (!videoModalOpen) {
              setVideoModalOpen(true);
            }
          } else {
            if (videoModalOpen) {
              setVideoModalOpen(false);
            }
            if (!audioOnlyMode) {
              setAudioOnlyMode(true);
            }
          }
        }}
        assignVideoRef={assignVideoRef}
        isVideoActive={isVideoActive}
        isMuted={isMuted}
        thumbnail={currentTrack?.thumbnail}
        title={currentTrack?.title}
        artist={currentTrack?.artist}
        onDisableVideo={() => {
          setVideoModalOpen(false);
          setAudioOnlyMode(true);
        }}
      />

      <VPNNotification
        isOpen={showVPNNotification}
        onClose={() => setShowVPNNotification(false)}
        message={vpnNotificationMessage}
      />
    </AnimatePresence>
  );
}
