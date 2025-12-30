import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Volume1,
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
  X,
  Music2,
  Plus,
  Image as ImageIcon,
  Activity,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayerStore, type PlayerStoreState } from "@/lib/playerStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { Track as PlayerTrack } from "@/lib/playerStore";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";

export function PlayerBar() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";
  
  const storeSlice = usePlayerStore(
    useShallow((state: PlayerStoreState) => ({
      currentTrack: state.currentTrack,
      isPlaying: state.isPlaying,
      togglePlay: state.togglePlay,
      playNext: state.playNext,
      playPrevious: state.playPrevious,
      duration: state.duration,
      currentTime: state.currentTime,
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
      setIsPlaying: state.setIsPlaying,
      setVolume: state.setVolume,
      isLoadingStream: state.isLoadingStream,
      removeFromQueue: state.removeFromQueue,
      clearQueue: state.clearQueue,
      audioElement: state.audioElement,
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
    setIsPlaying,
    setVolume,
    isLoadingStream,
    removeFromQueue,
    clearQueue,
    audioElement,
  } = storeSlice;

  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  
  // Fullscreen state
  const [fullscreenPanel, setFullscreenPanel] = useState<"info" | "lyrics" | "queue" | "visualizer" | "cover">("info");
  
  // Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>();
  const phaseRef = useRef(0); 

  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  // --- BUG FIX 1: Stop audio immediately on track change or load start ---
  useEffect(() => {
    if (audioElement && (isLoadingStream)) {
        audioElement.pause();
    }
  }, [isLoadingStream, audioElement]);

  // --- BUG FIX 2: Safety check to ensure audio is paused when video is open ---
  useEffect(() => {
    if (videoModalOpen && audioElement) {
       audioElement.pause();
       if (isPlaying) setIsPlaying(false);
    }
  }, [videoModalOpen, audioElement]); // Removed isPlaying to avoid loop

  // Double check: Pause when current track ID changes to prevent "Ghost" playing
  useEffect(() => {
    if(audioElement) {
       audioElement.pause();
    }
  }, [currentTrack?.id, currentTrack?.youtubeId, audioElement]);


  // Fetch playlists
  const { data: userPlaylists } = useQuery<any[]>({
    queryKey: ["/api/playlists"],
    enabled: !!currentTrack, 
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: async (playlistId: string) => {
        if (!currentTrack) throw new Error("No track selected");
        
        const res = await fetch(`${API_URL}/api/playlists/${playlistId}/tracks`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
        });
        
        if (res.ok) {
            const existingTracks = await res.json();
            const isDuplicate = existingTracks.some((t: any) => 
                (t.youtubeId && t.youtubeId === currentTrack.youtubeId) || 
                (t.fileUrl && t.fileUrl === currentTrack.fileUrl)
            );
            if (isDuplicate) throw new Error("Song already in playlist");
        }

        await apiRequest("POST", `/api/playlists/${playlistId}/tracks`, {
            youtubeId: currentTrack.youtubeId || currentTrack.id,
            title: currentTrack.title,
            artist: currentTrack.artist,
            thumbnail: currentTrack.thumbnail,
            duration: currentTrack.duration,
            fileUrl: currentTrack.fileUrl 
        });
        return playlistId;
    },
    onSuccess: (playlistId) => {
        toast({ title: "Added to playlist" });
        queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
        queryClient.invalidateQueries({ queryKey: ["/api/playlists/tracks"] });
        queryClient.invalidateQueries({ queryKey: ["playlist-smart-data", playlistId] });
    },
    onError: (error: Error) => {
        toast({ 
            title: error.message === "Song already in playlist" ? "Already added" : "Failed to add song", 
            description: error.message,
            variant: error.message === "Song already in playlist" ? "default" : "destructive" 
        });
    }
  });

  // --- VISUALIZER LOGIC ---
  useEffect(() => {
    if (!isFullscreen || fullscreenPanel !== "visualizer" || !audioElement || !canvasRef.current) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
    }

    try {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;

        if (!sourceRef.current) {
            if (!audioElement.crossOrigin) {
                audioElement.crossOrigin = "anonymous";
            }
            try {
                sourceRef.current = ctx.createMediaElementSource(audioElement);
                analyzerRef.current = ctx.createAnalyser();
                analyzerRef.current.fftSize = 512;
                analyzerRef.current.smoothingTimeConstant = 0.8;
                sourceRef.current.connect(analyzerRef.current);
                analyzerRef.current.connect(ctx.destination);
            } catch (e) {
                console.warn("Visualizer connection warning:", e);
            }
        }

        const renderFrame = () => {
            const canvas = canvasRef.current;
            const analyzer = analyzerRef.current;
            if (!canvas || !analyzer) return;

            const canvasCtx = canvas.getContext("2d");
            if (!canvasCtx) return;

            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }

            const width = canvas.width;
            const height = canvas.height;
            const bufferLength = analyzer.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyzer.getByteFrequencyData(dataArray);

            let sum = 0;
            for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const averageVolume = sum / bufferLength;
            const amplitude = 10 + (averageVolume / 255) * (height / 2.5);

            canvasCtx.clearRect(0, 0, width, height);
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            canvasCtx.shadowBlur = 8;
            canvasCtx.shadowColor = "rgba(255, 255, 255, 0.6)";

            canvasCtx.beginPath();
            const frequency = 0.02;
            for (let x = 0; x < width; x++) {
                const y = (height / 2) + Math.sin(x * frequency + phaseRef.current) * amplitude;
                if (x === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
            }
            canvasCtx.stroke();
            phaseRef.current += 0.08 + (averageVolume / 255) * 0.05;
            animationFrameRef.current = requestAnimationFrame(renderFrame);
        };
        renderFrame();
    } catch (err) {
        console.error("Audio Context Setup Error:", err);
    }

    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isFullscreen, fullscreenPanel, audioElement]);

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

  const handleSeekChange = (value: number[]) => setScrubTime(value[0]);
  
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
    if(isFullscreen) setFullscreenPanel("info");
  };

  const handleRemoveFromQueue = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromQueue(index);
  };

  const handlePlayTrack = (track: PlayerTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTrack(track);
    requestSeek(0);
  };

  const isTrackPlaying = (track: PlayerTrack) => {
    return track.youtubeId === currentTrack?.youtubeId || track.id === currentTrack?.id;
  };

  const handleVideoToggle = () => {
    // Logic: If we are opening the video (either because it was Audio Only, or Modal was closed)
    const willOpenVideo = audioOnlyMode || !videoModalOpen;

    if (willOpenVideo) {
        // 1. Force Pause the Audio Element
        if (audioElement) {
            audioElement.pause();
        }
        // 2. Update Global Play State to Paused
        setIsPlaying(false);
        
        // 3. Set Video Mode
        setAudioOnlyMode(false);
        setVideoModalOpen(true);
    } else {
        // Closing video / Returning to Audio Mode
        setVideoModalOpen(false);
        setAudioOnlyMode(true);
    }
  };

  const handleClosePlayer = () => {
    if (audioElement) {
        audioElement.pause(); 
        audioElement.currentTime = 0;
        audioElement.src = ""; 
    }
    setIsPlaying(false);
    setCurrentTrack(null);
  };

  const fetchLyrics = async () => {
      if (!currentTrack) return;
      setLyricsLoading(true);
      setLyricsError(null);
      try {
          const res = await fetch(`${API_URL}/api/lyrics?title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist || "")}`);
          const data = await res.json();
          if (data.lyrics) setLyrics(data.lyrics);
          else setLyricsError("Lyrics not found");
      } catch (e) {
          setLyricsError("Failed to load lyrics");
      } finally {
          setLyricsLoading(false);
      }
  };

  if (!currentTrack) return null;

  return (
    <>
    {/* CSS Overrides for YouTube-Style Slider */}
    <style>{`
      .yt-slider .relative.w-full.grow {
        height: 3px !important;
        transition: height 0.1s ease-in-out;
        background-color: rgba(255, 255, 255, 0.2);
      }
      .yt-slider:hover .relative.w-full.grow {
        height: 5px !important;
      }
      .yt-slider span[role="slider"] {
        height: 12px !important;
        width: 12px !important;
        opacity: 0;
        transform: scale(0.5);
        transition: opacity 0.1s ease, transform 0.1s ease;
        border: none !important;
        background-color: #fff !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
      .yt-slider:hover span[role="slider"] {
        opacity: 1;
        transform: scale(1);
      }
      .yt-slider span[data-orientation="horizontal"] > span {
         background-color: hsl(var(--primary));
      }
    `}</style>

    <div className="fixed bottom-20 left-0 right-0 z-50 px-3 pb-1 sm:px-6 md:bottom-4">
      {/* Queue Panel (Mini Player) */}
      <AnimatePresence>
        {showQueuePanel && (
          <motion.div
            key="queue-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-3 right-3 mb-4 max-h-[28rem] w-auto overflow-hidden rounded-3xl border border-white/10 bg-background/95 shadow-2xl backdrop-blur-xl sm:left-6 sm:right-6"
            style={{ maxWidth: '1280px', marginLeft: 'auto', marginRight: 'auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Music2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  Queue <span className="text-muted-foreground">({queue.length})</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {queue.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/10"
                    onClick={(e) => { e.stopPropagation(); clearQueue(); }}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 rounded-lg hover:bg-white/10"
                  onClick={() => setShowQueuePanel(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Queue List */}
            <div className="max-h-[20rem] overflow-y-auto p-2">
              {queue.length ? (
                <div className="space-y-1">
                  {queue.map((track: PlayerTrack, index: number) => {
                    const isCurrentTrack = isTrackPlaying(track);
                    const isCurrentlyPlaying = isCurrentTrack && isPlaying;
                    return (
                      <motion.div
                        key={`${track.youtubeId ?? track.id ?? index}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                          isCurrentTrack
                            ? "bg-primary/20 border border-primary/30 shadow-lg shadow-primary/10"
                            : "hover:bg-white/5 border border-transparent"
                        )}
                      >
                        <button
                          onClick={(e) => handlePlayTrack(track, e)}
                          className={cn(
                            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all",
                            isCurrentTrack
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "bg-white/10 text-foreground/70 hover:bg-white/20 hover:text-foreground"
                          )}
                        >
                          {isCurrentTrack && isLoadingStream ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isCurrentlyPlaying ? (
                            <Pause className="h-4 w-4" fill="currentColor" />
                          ) : (
                            <Play className="h-4 w-4" fill="currentColor" />
                          )}
                        </button>

                        <div className="relative flex-shrink-0">
                          {track.thumbnail ? (
                              <img
                                src={track.thumbnail}
                                alt={track.title}
                                className={cn("h-12 w-12 rounded-lg object-cover transition-all", isCurrentTrack ? "ring-2 ring-primary/50" : "")}
                              />
                          ) : (
                              <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 transition-all", isCurrentTrack ? "ring-2 ring-primary/50" : "")}>
                                  <Music2 className="h-6 w-6 text-muted-foreground" />
                              </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm font-medium", isCurrentTrack ? "text-primary" : "text-foreground")}>
                            {track.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {track.artist || "Unknown Artist"}
                          </p>
                        </div>

                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatTime(track.duration ?? 0)}
                        </span>

                        <button
                          onClick={(e) => handleRemoveFromQueue(index, e)}
                          className={cn(
                            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all",
                            "opacity-0 group-hover:opacity-100",
                            "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          )}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Music2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Queue is empty</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Bar */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative mx-auto flex h-auto max-w-[1280px] flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,hsla(210,90%,62%,0.22),transparent_55%),radial-gradient(circle_at_bottom_right,hsla(315,85%,58%,0.18),transparent_45%)] p-4 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:gap-6 md:px-6 md:py-4"
      >
        <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-[0.08]"></div>
        <div className="relative flex w-full flex-col items-center gap-4 md:flex-row md:gap-6">
        
        {/* Track Info */}
        <div className="flex w-full items-center gap-3 md:w-1/3">
          {currentTrack.thumbnail ? (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className={cn(
                  "h-14 w-14 flex-shrink-0 rounded-2xl object-cover shadow-lg transition-transform duration-500 lg:h-16 lg:w-16",
                  isPlaying ? "scale-100" : "scale-[0.97]",
                )}
              />
          ) : (
              <div className={cn("flex h-14 w-14 lg:h-16 lg:w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-lg transition-transform duration-500", isPlaying ? "scale-100" : "scale-[0.97]")}>
                  <Music2 className="h-8 w-8 text-white/50" />
              </div>
          )}
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground md:text-base">
                {currentTrack.title}
              </p>
              {isLoadingStream && (
                <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground/80 md:text-sm">
              {currentTrack.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Playback Controls (Mini) */}
        <div className="flex w-full flex-1 flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 shadow-inner shadow-black/20 backdrop-blur">
            <Button size="icon" variant="ghost" onClick={toggleShuffle} className={cn("h-9 w-9 rounded-full bg-white/10 text-foreground hover:bg-white/20", isShuffle && "bg-primary/20 text-primary border border-primary/30")}><Shuffle className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={playPrevious} className="h-10 w-10 rounded-full bg-white/5 text-foreground hover:bg-white/15"><SkipBack className="h-5 w-5" /></Button>
            <Button size="icon" onClick={togglePlay} disabled={isLoadingStream} className="group h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/40 transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoadingStream ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={playNext} className="h-10 w-10 rounded-full bg-white/5 text-foreground hover:bg-white/15"><SkipForward className="h-5 w-5" /></Button>
            <Button size="icon" variant="ghost" onClick={toggleRepeat} className={cn("h-9 w-9 rounded-full bg-white/10 text-foreground hover:bg-white/20", isRepeat && "bg-primary/20 text-primary border border-primary/30")}><Repeat className="h-4 w-4" /></Button>
          </div>

          {/* Progress Bar (Mini) */}
          <div className="flex w-full max-w-3xl items-center gap-3">
            <span className="w-12 text-right text-xs font-semibold text-white/60 tabular-nums">{formatTime(displayCurrentTime)}</span>
            {/* Custom YouTube-style slider using CSS overrides */}
            <Slider 
                value={[displayCurrentTime]} 
                max={duration} 
                step={1} 
                onValueChange={handleSeekChange} 
                onValueCommit={handleSeekCommit} 
                className="yt-slider flex-1 cursor-pointer"
            />
            <span className="w-12 text-xs font-semibold text-white/60 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Controls (Mini) - Volume Slider REMOVED */}
        <div className="flex w-full items-center justify-end gap-2 md:w-1/3 md:gap-3">
          <Button size="icon" variant="ghost" onClick={() => navigate("/lyrics")} className="h-9 w-9 rounded-full bg-white/5 text-foreground hover:bg-white/15"><Mic2 className="h-4 w-4" /></Button>

          {currentTrack.source === 'youtube' && (
            <Button size="icon" variant="ghost" onClick={handleVideoToggle} className="h-9 w-9 rounded-full bg-white/5 text-foreground hover:bg-white/15">
              {audioOnlyMode ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => { 
                toggleFullscreen(); 
                if (!isFullscreen && currentTrack?.source === 'youtube' && !audioOnlyMode) setVideoModalOpen(true); 
            }} className="h-9 w-9 rounded-full bg-white/5 text-foreground hover:bg-white/15">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button size="icon" variant="ghost" onClick={() => setShowQueuePanel((prev) => !prev)} className="h-9 w-9 rounded-full bg-white/5 text-foreground hover:bg-white/15">
            <List className="h-4 w-4" />
          </Button>

          {/* Mute Button Only - No Slider here */}
           <Button size="icon" variant="ghost" onClick={toggleMute} className="h-9 w-9 rounded-full bg-white/5 text-foreground hover:bg-white/15 hidden md:flex">
             {isMuted || volumeValue === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
           </Button>

          <Button size="icon" variant="ghost" onClick={handleClosePlayer} className="h-9 w-9 rounded-full bg-white/5 text-foreground hover:bg-red-500/20 hover:text-red-400">
            <X className="h-4 w-4" />
          </Button>
        </div>
        </div>
      </motion.div>

      {/* FULLSCREEN OVERLAY */}
      <AnimatePresence>
      {isFullscreen && (
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
            <Button size="sm" variant="ghost" className="rounded-full border border-white/20 bg-white/10 px-4 text-white shadow-lg backdrop-blur hover:bg-white/20" onClick={toggleFullscreen}>
              Exit Fullscreen
            </Button>
          </div>

          <div className="relative z-10 flex h-full w-full flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-center lg:gap-10 lg:px-12">
            
            {/* Left Section: Cover Image ONLY */}
            <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col gap-4 hidden lg:flex">
                <div className="relative w-full aspect-video sm:aspect-[4/3] overflow-hidden rounded-[32px] border border-white/15 bg-black/40 shadow-2xl">
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        {currentTrack?.thumbnail ? (
                            <img src={currentTrack.thumbnail} alt={currentTrack.title} className="h-full w-full object-cover" />
                        ) : (
                            <Music2 className="h-32 w-32 text-white/30" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/60 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Right: Controls Panel */}
            <div className="mx-auto w-full max-w-xl flex flex-col gap-5 rounded-[32px] border border-white/10 bg-white/5 p-6 text-white shadow-xl backdrop-blur-xl sm:p-8">
                
                {/* 1. Header with Video Toggle & Add Playlist */}
                <div className="flex flex-wrap gap-2 justify-between items-center mb-2 border-b border-white/10 pb-4">
                    <div className="flex gap-2">
                        {currentTrack.source === 'youtube' && (
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={handleVideoToggle}
                                className="rounded-full border border-white/15 bg-white/10 px-4 text-white hover:bg-white/20"
                            >
                                {audioOnlyMode ? "Enable Video" : "Audio Only"}
                            </Button>
                        )}
                        {!audioOnlyMode && !videoModalOpen && currentTrack.source === 'youtube' && (
                            <Button size="sm" variant="ghost" onClick={() => setVideoModalOpen(true)} className="rounded-full border border-white/15 bg-white/10 px-4 text-white hover:bg-white/20">
                                Open Video
                            </Button>
                        )}
                    </div>
                    
                    {/* Add to Playlist Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button size="sm" variant="default" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 shadow-lg">
                                <Plus className="h-4 w-4 mr-2" /> Add to Playlist
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2 bg-background/95 backdrop-blur border-white/10">
                            <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5 mb-1">Select Playlist</p>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {userPlaylists && userPlaylists.length > 0 ? (
                                    userPlaylists.map((playlist) => (
                                        <Button
                                            key={playlist.id}
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start text-sm"
                                            onClick={() => addToPlaylistMutation.mutate(playlist.id)}
                                        >
                                            <List className="h-4 w-4 mr-2 opacity-50" />
                                            {playlist.name}
                                        </Button>
                                    ))
                                ) : (
                                    <div className="px-2 py-2 text-center">
                                        <p className="text-xs text-muted-foreground mb-2">No playlists yet</p>
                                        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => { toggleFullscreen(); navigate('/create-playlist'); }}>
                                            Create Playlist
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* 2. Track Info */}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-white">{currentTrack.title}</h1>
                    <p className="text-lg text-white/70">{currentTrack.artist}</p>
                </div>

                {/* 3. Panel Switcher (Horizontal Scroll Container) */}
                <div className="flex gap-2 p-1 bg-black/20 rounded-full w-full overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <Button size="sm" variant="ghost" onClick={() => setFullscreenPanel('info')} className={cn("rounded-full h-8 px-4 flex-shrink-0", fullscreenPanel === 'info' ? "bg-white/20 text-white" : "text-white/60 hover:text-white")}><Info className="h-4 w-4 mr-2" /> Info</Button>
                    <Button size="sm" variant="ghost" onClick={() => { fetchLyrics(); setFullscreenPanel('lyrics'); }} className={cn("rounded-full h-8 px-4 flex-shrink-0", fullscreenPanel === 'lyrics' ? "bg-white/20 text-white" : "text-white/60 hover:text-white")}><Mic2 className="h-4 w-4 mr-2" /> Lyrics</Button>
                    <Button size="sm" variant="ghost" onClick={() => setFullscreenPanel('queue')} className={cn("rounded-full h-8 px-4 flex-shrink-0", fullscreenPanel === 'queue' ? "bg-white/20 text-white" : "text-white/60 hover:text-white")}><List className="h-4 w-4 mr-2" /> Queue</Button>
                    <Button size="sm" variant="ghost" onClick={() => setFullscreenPanel('cover')} className={cn("rounded-full h-8 px-4 flex-shrink-0", fullscreenPanel === 'cover' ? "bg-white/20 text-white" : "text-white/60 hover:text-white")}><ImageIcon className="h-4 w-4 mr-2" /> Cover</Button>
                    <Button size="sm" variant="ghost" onClick={() => setFullscreenPanel('visualizer')} className={cn("rounded-full h-8 px-4 flex-shrink-0", fullscreenPanel === 'visualizer' ? "bg-white/20 text-white" : "text-white/60 hover:text-white")}><Activity className="h-4 w-4 mr-2" /> Visualizer</Button>
                </div>

                {/* 4. Panels Content */}
                <div className="h-40 overflow-hidden relative">
                    {fullscreenPanel === 'info' && (
                        <div className="flex flex-col justify-center h-full text-white/60 text-sm">
                            <p>Source: {currentTrack.source === 'local' ? 'Local File' : 'YouTube'}</p>
                            <p>Duration: {formatTime(duration)}</p>
                        </div>
                    )}
                    {fullscreenPanel === 'lyrics' && (
                        <div className="h-full overflow-y-auto pr-2 text-white/90 text-center space-y-4">
                            {lyricsLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto mt-10" /> : 
                             lyricsError ? <p className="mt-10 opacity-60">{lyricsError}</p> : 
                             lyrics ? <p className="whitespace-pre-wrap leading-relaxed">{lyrics}</p> : 
                             <p className="mt-10 opacity-60">Click Lyrics to load</p>}
                        </div>
                    )}
                    {fullscreenPanel === 'queue' && (
                        <div className="h-full overflow-y-auto pr-2 space-y-1">
                            {queue.map((t, i) => (
                                <div key={i} onClick={() => handleQueueSelect(t)} className={cn("flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/10", isTrackPlaying(t) && "bg-white/10")}>
                                    {t.thumbnail ? <img src={t.thumbnail} className="h-8 w-8 rounded object-cover" /> : <Music2 className="h-8 w-8 p-1.5 bg-white/10 rounded" />}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate text-white">{t.title}</p>
                                        <p className="text-xs text-white/60 truncate">{t.artist}</p>
                                    </div>
                                    {isTrackPlaying(t) && <Volume2 className="h-4 w-4 text-primary" />}
                                </div>
                            ))}
                        </div>
                    )}
                    {fullscreenPanel === 'cover' && (
                        <div className="h-full w-full flex items-center justify-center rounded-xl overflow-hidden bg-black/20">
                             {currentTrack.thumbnail ? <img src={currentTrack.thumbnail} className="h-full object-contain shadow-xl" /> : <Music2 className="h-16 w-16 text-white/20" />}
                        </div>
                    )}
                    {fullscreenPanel === 'visualizer' && (
                         <div className="h-full w-full flex items-center justify-center rounded-xl bg-black/40 overflow-hidden border border-white/5">
                            <canvas ref={canvasRef} className="w-full h-full" />
                        </div>
                    )}
                </div>

                {/* 5. Scrubber & Controls */}
                <div className="space-y-4 pt-2 border-t border-white/10">
                    {/* Time Scrubber */}
                    <div className="flex items-center gap-3 text-sm text-white/60">
                        <span className="w-10 text-right tabular-nums">{formatTime(displayCurrentTime)}</span>
                        {/* Custom YouTube-style slider */}
                        <Slider 
                            value={[displayCurrentTime]} 
                            max={duration || 100} 
                            onValueChange={handleSeekChange} 
                            onValueCommit={handleSeekCommit} 
                            className="yt-slider flex-1 cursor-pointer"
                        />
                        <span className="w-10 tabular-nums">{formatTime(duration || 0)}</span>
                    </div>

                    {/* Main Controls + Shuffle/Repeat */}
                    <div className="flex items-center justify-center gap-4 sm:gap-8">
                        {/* Shuffle Button */}
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={toggleShuffle} 
                            className={cn(
                                "h-10 w-10 rounded-full transition-colors", 
                                isShuffle ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-white/5 text-white/70 hover:bg-white/15 hover:text-white"
                            )}
                        >
                            <Shuffle className="h-5 w-5" />
                        </Button>

                        <Button size="icon" variant="ghost" onClick={playPrevious} className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20">
                            <SkipBack className="h-6 w-6" />
                        </Button>
                        
                        <Button size="icon" onClick={togglePlay} className="h-16 w-16 rounded-full bg-primary text-white shadow-xl hover:scale-105 transition-transform">
                            {isPlaying ? <Pause className="h-8 w-8" fill="currentColor" /> : <Play className="h-8 w-8" fill="currentColor" />}
                        </Button>
                        
                        <Button size="icon" variant="ghost" onClick={playNext} className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20">
                            <SkipForward className="h-6 w-6" />
                        </Button>

                        {/* Repeat Button */}
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={toggleRepeat} 
                            className={cn(
                                "h-10 w-10 rounded-full transition-colors", 
                                isRepeat ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-white/5 text-white/70 hover:bg-white/15 hover:text-white"
                            )}
                        >
                            <Repeat className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Volume Controls (Hidden on mobile) */}
                    <div className="hidden md:flex items-center justify-center w-full max-w-[200px] mx-auto gap-3 pt-2">
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={toggleMute} 
                            className="h-8 w-8 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                        >
                            {isMuted || volumeValue === 0 ? <VolumeX className="h-5 w-5" /> : volumeValue < 0.5 ? <Volume1 className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </Button>
                        {/* Custom YouTube-style volume slider */}
                        <Slider 
                            value={[isMuted ? 0 : volumeValue]} 
                            max={1} 
                            step={0.01} 
                            onValueChange={handleVolumeChange} 
                            className="yt-slider w-full cursor-pointer" 
                        />
                    </div>
                </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
    </>
  );
}