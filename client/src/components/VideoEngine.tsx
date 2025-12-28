// VideoEngine.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import VideoModal from "@/components/VideoModal";
import { getBestAudioStreamUrl, type ResolvedStream } from "@/lib/youtubeStream";
import { usePlayerStore } from "@/lib/playerStore";

export function VideoEngine() {
  const streamInfoRef = useRef<ResolvedStream | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [version, setVersion] = useState(0); // bump to force re-render

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    setCurrentTime,
    setIsPlaying,
    playNext,
    requestSeek,
    audioOnlyMode,
    setAudioOnlyMode,
    videoModalOpen,
    setVideoModalOpen,
    togglePlay,
    toggleMute,
    setVolume,
  } = usePlayerStore(
    useShallow((state) => ({
      currentTrack: state.currentTrack,
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      duration: state.duration,
      volume: state.volume,
      isMuted: state.isMuted,
      setCurrentTime: state.setCurrentTime,
      setIsPlaying: state.setIsPlaying,
      playNext: state.playNext,
      requestSeek: state.requestSeek,
      audioOnlyMode: state.audioOnlyMode,
      setAudioOnlyMode: state.setAudioOnlyMode,
      videoModalOpen: state.videoModalOpen,
      setVideoModalOpen: state.setVideoModalOpen,
      togglePlay: state.togglePlay,
      toggleMute: state.toggleMute,
      setVolume: state.setVolume,
    }))
  );

  const cleanupVideo = useCallback(() => {
    streamInfoRef.current = null;
    setIsLoadingVideo(false);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    return () => cleanupVideo();
  }, [cleanupVideo]);

  // Load video/audio stream info when modal opens
  useEffect(() => {
    if (
      !videoModalOpen ||
      !currentTrack ||
      currentTrack.source !== "youtube" ||
      !currentTrack.youtubeId
    ) {
      cleanupVideo();
      return;
    }

    let cancelled = false;
    const trackWithSource = currentTrack as typeof currentTrack & {
      streamSource?: "piped" | "invidious";
      streamInstance?: string | null;
    };

    const run = async () => {
      setIsLoadingVideo(true);
      try {
        const info = await getBestAudioStreamUrl(currentTrack.youtubeId!, {
          source: trackWithSource.streamSource,
          instance: trackWithSource.streamInstance,
        });
        if (cancelled) return;
        streamInfoRef.current = info ?? null;
        setIsLoadingVideo(false);
        setVersion((v) => v + 1);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load video stream:", error);
        setIsLoadingVideo(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [currentTrack, videoModalOpen, cleanupVideo]);

  const streamInfo = streamInfoRef.current;

  return (
    <VideoModal
      key={version} // force re-init on stream change
      open={videoModalOpen} // always show modal when open
      onClose={() => {
        setVideoModalOpen(false);
        setAudioOnlyMode(true);
        cleanupVideo();
      }}
      videoId={currentTrack?.youtubeId}
      bestData={streamInfo}
      startMuted={isMuted}
      thumbnail={currentTrack?.thumbnail}
      title={currentTrack?.title}
      artist={currentTrack?.artist}
    />
  );
}
