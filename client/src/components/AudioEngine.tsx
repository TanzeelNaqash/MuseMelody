import { useEffect, useRef, useState } from "react";
import { usePlayerStore, type PlayerStoreState } from "@/lib/playerStore";
import { useShallow } from "zustand/react/shallow";
import { getBestAudioStreamUrl, type ResolvedStream } from "@/lib/youtubeStream";
import Hls from "hls.js";
import { useToast } from "@/hooks/use-toast";
import { VPNNotification } from "@/components/VPNNotification";

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioHlsRef = useRef<Hls | null>(null);
  const streamInfoRef = useRef<ResolvedStream | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const [showVPNNotification, setShowVPNNotification] = useState(false);
  const [vpnNotificationMessage, setVpnNotificationMessage] = useState<string | undefined>();
  const { toast } = useToast();
  
  // Define API_URL here to fix local file paths
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";

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
      setAudioElement: state.setAudioElement,
      videoElement: state.videoElement,
      pendingSeek: state.pendingSeek,
      clearPendingSeek: state.clearPendingSeek,
      audioOnlyMode: state.audioOnlyMode,
      requestSeek: state.requestSeek,
      queue: state.queue,
      setCurrentTrack: state.setCurrentTrack,
      isLoadingStream: state.isLoadingStream,
      setIsLoadingStream: state.setIsLoadingStream,
      isRepeat: state.isRepeat,
    })),
  );

  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    playNext,
    setAudioElement,
    pendingSeek,
    clearPendingSeek,
    audioOnlyMode,
    isRepeat,
    setIsLoadingStream,
  } = storeSlice;

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
      if (isRepeat && currentTrack) {
        setCurrentTime(0);
        usePlayerStore.getState().requestSeek(0);
        return;
      }
      playNext();
    };
    const onError = (e: Event) => {
      console.error("Audio playback error", e);
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
      if (audioHlsRef.current) {
        audioHlsRef.current.destroy();
        audioHlsRef.current = null;
      }
    };
  }, [playNext, setAudioElement, setCurrentTime, setDuration, setIsPlaying]);

  // Load source for current track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;
    let localBlobUrl: string | null = null;

    const cleanupHls = () => {
      if (audioHlsRef.current) {
        audioHlsRef.current.destroy();
        audioHlsRef.current = null;
      }
    };

    const run = async () => {
      if (!currentTrack) {
        cleanupHls();
        audio.removeAttribute("src");
        streamInfoRef.current = null;
        return;
      }

      cleanupHls();
      audio.pause();
      
      if (currentTrack.source === "youtube" && currentTrack.youtubeId) {
         try {
             setIsLoadingStream(true);
             const info = await getBestAudioStreamUrl(currentTrack.youtubeId);
             if (cancelled) return;
             setIsLoadingStream(false);
             
             if(info) {
                 streamInfoRef.current = info;
                 const directUrl = info.proxiedUrl ?? info.rawUrl ?? info.url;
                 if(directUrl) {
                     audio.src = directUrl;
                     audio.load();
                 }
             }
         } catch(e) { 
             console.error(e); 
             setIsLoadingStream(false); 
             toast({ title: "Error", description: "Stream load failed", variant: "destructive" });
         }

      } else if (currentTrack.source === "local" && currentTrack.fileUrl) {
        // --- FIXED LOCAL FILE LOADING ---
        try {
            setIsLoadingStream(true);
            const token = localStorage.getItem("auth_token");
            
            // 1. Construct the FULL URL properly
            const fullUrl = currentTrack.fileUrl.startsWith('http') 
                ? currentTrack.fileUrl 
                : `${API_URL}${currentTrack.fileUrl}`;

            // 2. Fetch using auth headers
            const response = await fetch(fullUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                // If we get an HTML page (like the 404 page), throw error
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("text/html")) {
                    throw new Error("Invalid audio file (Server returned HTML)");
                }
                throw new Error("Failed to load local file");
            }

            // 3. Create Blob URL
            const blob = await response.blob();
            localBlobUrl = URL.createObjectURL(blob);
            
            if (audio.src !== localBlobUrl) {
                audio.src = localBlobUrl;
                audio.load();
            }
            setIsLoadingStream(false);
        } catch (e) {
            console.error("Local file load error", e);
            setIsLoadingStream(false);
            toast({ title: "Error", description: "Failed to play local file. Please try re-uploading.", variant: "destructive" });
        }
      }
      
      if (isPlaying) {
          try { await audio.play(); } catch {}
      }
    };

    run();

    return () => {
      cancelled = true;
      cleanupHls();
      if (localBlobUrl) {
          URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [currentTrack, audioOnlyMode]);

  // Volume & Play state watchers
  useEffect(() => {
    const media = audioRef.current;
    if (!media) return;
    if (isPlaying) media.play().catch(() => {});
    else media.pause();
  }, [isPlaying]);

  useEffect(() => {
    const media = audioRef.current;
    if (!media) return;
    media.muted = isMuted;
    media.volume = Number(volume) > 1 ? Number(volume) / 100 : Number(volume);
  }, [isMuted, volume]);

  return null;
}