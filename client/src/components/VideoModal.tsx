import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Popover,
  MenuItem,
  List,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeDownIcon from "@mui/icons-material/VolumeDown";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import HdIcon from "@mui/icons-material/Hd";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Replay10Icon from "@mui/icons-material/Replay10";
import Forward10Icon from "@mui/icons-material/Forward10";

import { usePlayerStore } from "@/lib/playerStore";
import type { ResolvedStream } from "@/lib/youtubeStream";

/* ===================== HELPERS ===================== */

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5001";

const buildProxyUrl = (id: string, rawUrl?: string | null) => {
  if (!id || !rawUrl) return null;
  return `${API}/api/streams/${id}/proxy?src=${encodeURIComponent(rawUrl)}`;
};

const formatTime = (t: number) => {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const ITAG_MAP: Record<number, string> = {
  137: "1080p", 248: "1080p", 399: "1080p",
  136: "720p",  247: "720p",  398: "720p",
  135: "480p",  244: "480p",  397: "480p",
  134: "360p",  243: "360p",  396: "360p",
  133: "240p",  242: "240p",  395: "240p",
  160: "144p",  278: "144p",  394: "144p",
};

const getQualityLabel = (stream: any) => {
  if (stream.height && stream.height > 0) return `${stream.height}p`;
  if (stream.qualityLabel) return stream.qualityLabel;
  if (stream.itag && ITAG_MAP[Number(stream.itag)]) return ITAG_MAP[Number(stream.itag)];
  return `Bitrate: ${(stream.bitrate / 1024).toFixed(0)}k`;
};

/* ===================== COMPONENT ===================== */

export default function VideoModal({
  open,
  onClose,
  videoId,
  bestData,
  thumbnail,
  title, // Added title prop
}: {
  open: boolean;
  onClose: () => void;
  videoId: string;
  bestData?: ResolvedStream | null;
  thumbnail?: string | null;
  title?: string; // Type for title prop
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hideTimer = useRef<number | null>(null);
  const skipTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Responsive Hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const setVideoElement = usePlayerStore((s) => s.setVideoElement);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Start with black to avoid flash
  const [bgColor, setBgColor] = useState<string>("#000000"); 
  const [skipAccumulator, setSkipAccumulator] = useState<number | null>(null);

  const [qualityAnchor, setQualityAnchor] = useState<HTMLElement | null>(null);
  const [selectedItag, setSelectedItag] = useState<number | "auto">("auto");

  /* ===================== STREAM LOGIC ===================== */

  const { uniqueVideoStreams, bestVideo, bestAudio } = useMemo(() => {
    if (!bestData) return { uniqueVideoStreams: [], bestVideo: null, bestAudio: null };

    // 1. Get Video Streams
    let allV = bestData.videoStreams?.filter((s) => s.url && s.mimeType?.startsWith("video/")) ?? [];
    
    // 2. Sort by Bitrate (High to Low)
    allV.sort((a, b) => Number(b.bitrate ?? 0) - Number(a.bitrate ?? 0));

    // 3. Deduplicate based on Quality Label
    const seenQualities = new Set<string>();
    const uniqueV: typeof allV = [];

    allV.forEach(stream => {
      const label = getQualityLabel(stream);
      if (!seenQualities.has(label)) {
        seenQualities.add(label);
        uniqueV.push(stream);
      }
    });

    uniqueV.sort((a, b) => {
        const hA = parseInt(getQualityLabel(a)) || 0;
        const hB = parseInt(getQualityLabel(b)) || 0;
        return hB - hA; 
    });

    // 4. Select Stream
    const aStreams = bestData.audioStreams?.filter((s) => s.url && s.mimeType?.startsWith("audio/")) ?? [];
    
    let bVideo;
    if (selectedItag === "auto") {
        bVideo = allV.find(s => !s.mimeType?.includes("av01") && (parseInt(getQualityLabel(s)) >= 720)) || allV[0];
    } else {
        bVideo = allV.find((v) => Number(v.itag) === selectedItag);
    }

    const bAudio = [...aStreams].sort((a, b) => Number(b.bitrate ?? 0) - Number(a.bitrate ?? 0))[0];

    return { uniqueVideoStreams: uniqueV, bestVideo: bVideo, bestAudio: bAudio };
  }, [bestData, selectedItag]);

  const videoSrc = videoId && bestVideo?.url ? buildProxyUrl(videoId, bestVideo.url) : null;
  const audioSrc = videoId && bestAudio?.url ? buildProxyUrl(videoId, bestAudio.url) : null;

  /* ===================== LIFECYCLE ===================== */

  useEffect(() => {
    if (!open) return;
    if (!videoSrc) return;

    const v = videoRef.current;
    const a = audioRef.current;
    if (!v) return;

    setBuffering(true);
    v.src = videoSrc;
    v.muted = true;
    v.load();

    if (a && audioSrc) {
      a.src = audioSrc;
      a.load();
    }

    setVideoElement(v);
    setPlaying(false);

    if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
        canvasRef.current.width = 1; 
        canvasRef.current.height = 1;
    }

    return () => setVideoElement(null);
  }, [open, videoSrc, audioSrc, videoId, setVideoElement]);

  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v) return;

    const sync = () => {
      setTime(v.currentTime);
      if (a && Math.abs(a.currentTime - v.currentTime) > 0.25) {
        a.currentTime = v.currentTime;
      }
    };

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
        setBuffering(false);
        setPlaying(true);
        startHideTimer();
    };
    const onPause = () => setPlaying(false);

    // --- SMOOTH COLOR EXTRACTION ---
    const extractColor = () => {
        if (!v || v.paused || v.ended || v.readyState < 2 || !canvasRef.current) return;
        
        try {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
                ctx.drawImage(v, 0, 0, 1, 1);
                const pixel = ctx.getImageData(0, 0, 1, 1).data;
                const r = pixel[0];
                const g = pixel[1];
                const b = pixel[2];
                
                // Darken the extracted color slightly to ensure text legibility
                // and to make the transition less jarring
                setBgColor(`rgb(${r}, ${g}, ${b})`);
            }
        } catch (e) {
            // Ignore cross-origin errors
        }
    };

    // Extract slightly faster for responsiveness (2 seconds)
    const colorInterval = setInterval(extractColor, 2000); 

    v.addEventListener("timeupdate", sync);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("pause", onPause);
    v.addEventListener("loadedmetadata", () => {
        setDuration(v.duration || 0);
        setBuffering(false);
        setTimeout(extractColor, 500);
    });
    // Update color immediately on seek
    v.addEventListener("seeked", extractColor);

    return () => {
      clearInterval(colorInterval);
      v.removeEventListener("timeupdate", sync);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("loadedmetadata", () => {});
      v.removeEventListener("seeked", extractColor);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = muted ? 0 : volume;
        audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  /* ===================== CONTROLS LOGIC ===================== */

  const startHideTimer = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused && skipAccumulator === null) {
            setShowControls(false);
        }
    }, 3000);
  };

  const revealControls = () => {
    setShowControls(true);
    startHideTimer();
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v) return;

    if (!v.paused) {
      v.pause();
      a?.pause();
      setPlaying(false);
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      try {
        if (a && a.src) await a.play();
        await v.play();
        setPlaying(true);
        startHideTimer();
      } catch (err) {
        console.warn("Play blocked", err);
      }
    }
  };

  const handleSkip = useCallback((amount: number) => {
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    setSkipAccumulator((prev) => (prev === null ? amount : prev + amount));
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);

    skipTimerRef.current = setTimeout(() => {
        setSkipAccumulator((totalSkip) => {
            if (totalSkip !== null && videoRef.current) {
                const current = videoRef.current.currentTime;
                const target = Math.min(Math.max(current + totalSkip, 0), videoRef.current.duration || 0);
                
                videoRef.current.currentTime = target;
                if (audioRef.current) audioRef.current.currentTime = target;
                setTime(target);
            }
            return null;
        });
        startHideTimer();
    }, 600);
  }, []);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true));
      if (screen.orientation && 'lock' in screen.orientation) {
          (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
      if (screen.orientation && 'unlock' in screen.orientation) {
        (screen.orientation as any).unlock();
      }
    }
  };

  const getVolumeIcon = () => {
    if (muted || volume === 0) return <VolumeOffIcon fontSize={isMobile ? "medium" : "large"} />;
    if (volume < 0.5) return <VolumeDownIcon fontSize={isMobile ? "medium" : "large"} />;
    return <VolumeUpIcon fontSize={isMobile ? "medium" : "large"} />;
  };

  const handleVolumeChange = (_: Event, newValue: number | number[]) => {
    const val = Array.isArray(newValue) ? newValue[0] : newValue;
    setVolume(val);
    if (val > 0) setMuted(false);
  };

  if (!open) return null;

  return (
    <Box
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        touchAction: 'none',
        
        // --- SMOOTH TRANSITION MAGIC ---
        // 1. We set the SOLID color here. CSS can transition colors very smoothly.
        backgroundColor: bgColor,
        transition: 'background-color 2s cubic-bezier(0.4, 0, 0.2, 1)', 
      }}
    >
        {/* 2. We layer a STATIC gradient on top. 
            This goes from transparent (showing the transitioning color below) 
            to black (at the edges). Because this gradient string never changes,
            we don't get the "snap" effect.
        */}
        <Box 
            sx={{ 
                position: 'absolute', 
                inset: 0, 
                background: 'radial-gradient(circle, transparent 10%, black 100%)', 
                zIndex: 0,
                pointerEvents: 'none' // Let clicks pass through to video
            }} 
        />
        
        {/* Dark Overlay for controls contrast */}
        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', zIndex: 1, pointerEvents: 'none' }} />

        {/* Buffering Indicator */}
        {buffering && (
            <Box sx={{
                position: 'absolute', top: '50%', left: '50%', 
                transform: 'translate(-50%, -50%)', zIndex: 30 
            }}>
                <CircularProgress size={50} sx={{ color: 'white' }} />
            </Box>
        )}

        {/* Video Player */}
        <video
          ref={videoRef}
          preload="auto"
          crossOrigin="anonymous"
          playsInline
          poster={thumbnail || undefined}
          onClick={togglePlay}
          style={{ 
              width: "100%", 
              height: "100%", 
              objectFit: "contain",
              maxHeight: "100vh",
              position: 'relative',
              zIndex: 2, // Video sits above the background layers
          }}
        />

        <audio ref={audioRef} crossOrigin="anonymous" />

        {/* CENTER CONTROLS (Play, Skip, Rewind) */}
        <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 4 : 8,
              opacity: (showControls || !playing || skipAccumulator !== null) ? 1 : 0,
              transition: 'opacity 0.2s',
              pointerEvents: (showControls || !playing) ? 'auto' : 'none',
            }}
        >
            {/* Rewind 10s */}
            <IconButton 
                onClick={(e) => { e.stopPropagation(); handleSkip(-10); }}
                sx={{ 
                    color: 'white', 
                    bgcolor: 'rgba(0,0,0,0.3)', 
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
                    p: 2
                }}
            >
                <Replay10Icon sx={{ fontSize: isMobile ? 32 : 48 }} />
            </IconButton>

            {/* Play/Pause or Skip Indicator */}
            {skipAccumulator !== null ? (
                <Box sx={{ 
                    width: isMobile ? 64 : 80, height: isMobile ? 64 : 80, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: 'rgba(0,0,0,0.6)', borderRadius: '50%',
                    backdropFilter: 'blur(4px)'
                }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                        {skipAccumulator > 0 ? '+' : ''}{skipAccumulator}s
                    </Typography>
                </Box>
            ) : (
                <Box
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    sx={{
                    bgcolor: "rgba(0,0,0,0.4)",
                    borderRadius: '50%',
                    p: isMobile ? 2 : 3,
                    cursor: 'pointer',
                    display: 'flex',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    transition: 'transform 0.1s',
                    '&:active': { transform: 'scale(0.95)' }
                    }}
                >
                    {playing ? 
                        <PauseIcon sx={{ fontSize: isMobile ? 48 : 64, color: 'white' }} /> : 
                        <PlayArrowIcon sx={{ fontSize: isMobile ? 48 : 64, color: 'white' }} />
                    }
                </Box>
            )}

            {/* Forward 10s */}
            <IconButton 
                onClick={(e) => { e.stopPropagation(); handleSkip(10); }}
                sx={{ 
                    color: 'white', 
                    bgcolor: 'rgba(0,0,0,0.3)', 
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
                    p: 2
                }}
            >
                <Forward10Icon sx={{ fontSize: isMobile ? 32 : 48 }} />
            </IconButton>
        </Box>

        {/* TOP BAR */}
        <Box sx={{
            position: 'absolute', top: 0, left: 0, right: 0, p: 2,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
            display: showControls ? 'flex' : 'none',
            alignItems: 'center', // Align items vertically
            gap: 2, // Add gap between back button and title
            zIndex: 25,
            transition: 'opacity 0.3s'
        }}>
             <IconButton onClick={onClose} sx={{ color: 'white' }}>
                 <ArrowBackIcon />
             </IconButton>
             
             {/* Song Title */}
             <Typography 
               variant="h6" 
               sx={{ 
                 color: 'white', 
                 fontWeight: 'bold', 
                 textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                 overflow: 'hidden',
                 textOverflow: 'ellipsis',
                 whiteSpace: 'nowrap',
                 flex: 1 // Take up remaining space
               }}
             >
               {title || "Now Playing"}
             </Typography>
        </Box>
        

        {/* BOTTOM CONTROLS */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            p: isMobile ? 1.5 : 3,
            zIndex: 20,
            opacity: showControls ? 1 : 0,
            transition: "opacity 0.3s",
            background: "linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.6), transparent)",
            paddingBottom: isMobile ? 'safe-area-inset-bottom' : 3
          }}
        >
          {/* Progress Bar */}
          <Slider
            value={time}
            min={0}
            max={duration || 1}
            onChange={(_, v) => {
               const t = Array.isArray(v) ? v[0] : v;
               if (videoRef.current) videoRef.current.currentTime = t;
               if (audioRef.current) audioRef.current.currentTime = t;
               setTime(t);
            }}
            sx={{ 
                color: "#f00", 
                mb: 1, 
                p: 0,
                height: 4,
                '& .MuiSlider-thumb': {
                    width: isMobile ? 12 : 14,
                    height: isMobile ? 12 : 14,
                    transition: '0.2s',
                    '&:hover, &.Mui-active': {
                        boxShadow: '0 0 0 8px rgba(255, 0, 0, 0.16)',
                        width: 16, height: 16
                    }
                },
                '& .MuiSlider-rail': { opacity: 0.3, color: 'white' }
            }}
          />

          <Box sx={{ display: "flex", alignItems: "center", gap: isMobile ? 1 : 2 }}>
            <IconButton onClick={togglePlay} sx={{ color: "white", p: isMobile ? 0.5 : 1 }}>
              {playing ? <PauseIcon fontSize={isMobile ? "medium" : "large"} /> : <PlayArrowIcon fontSize={isMobile ? "medium" : "large"} />}
            </IconButton>

            {/* Volume Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', width: isMobile ? 100 : 140, gap: 1, mr: 1 }}>
                <IconButton 
                    onClick={() => setMuted(!muted)} 
                    sx={{ color: "white", p: 0.5 }}
                >
                    {getVolumeIcon()}
                </IconButton>
                <Slider
                    value={muted ? 0 : volume}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={handleVolumeChange}
                    sx={{ 
                        color: "white", 
                        height: 3,
                        '& .MuiSlider-thumb': { width: 12, height: 12 }
                    }}
                />
            </Box>

            <Typography sx={{ color: "white", fontSize: isMobile ? 12 : 14, fontFamily: 'monospace' }}>
              {formatTime(time)} / {formatTime(duration)}
            </Typography>

            <Box sx={{ flexGrow: 1 }} />

            {/* Quality Selector */}
            <IconButton 
                onClick={(e) => setQualityAnchor(e.currentTarget)} 
                sx={{ color: "white", borderRadius: 1, p: 0.5 }}
            >
              <HdIcon fontSize={isMobile ? "small" : "medium"} />
              <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 'bold' }}>
                 {selectedItag === "auto" ? "Auto" : getQualityLabel(bestVideo || {})}
              </Typography>
            </IconButton>

            <IconButton onClick={toggleFullscreen} sx={{ color: "white", p: 0.5 }}>
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Quality Menu */}
        <Popover
          open={!!qualityAnchor}
          anchorEl={qualityAnchor}
          container={containerRef.current}
          onClose={() => setQualityAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          transformOrigin={{ vertical: "bottom", horizontal: "center" }}
          sx={{ 
             '& .MuiPaper-root': { 
                 bgcolor: 'rgba(20,20,20,0.95)', 
                 color: 'white',
                 backdropFilter: 'blur(10px)',
                 border: '1px solid rgba(255,255,255,0.1)',
                 minWidth: 120
             } 
          }}
        >
          <List dense>
            <MenuItem 
                onClick={() => { setSelectedItag("auto"); setQualityAnchor(null); }}
                selected={selectedItag === "auto"}
                sx={{ '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.2)' } }}
            >
                Auto (Recommended)
            </MenuItem>
            {uniqueVideoStreams.map((v) => (
              <MenuItem
                key={`${v.itag}-${getQualityLabel(v)}`}
                selected={Number(v.itag) === selectedItag}
                onClick={() => { setSelectedItag(Number(v.itag)); setQualityAnchor(null); }}
                sx={{ '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              >
                {getQualityLabel(v)}
              </MenuItem>
            ))}
          </List>
        </Popover>

    </Box>
  );
}