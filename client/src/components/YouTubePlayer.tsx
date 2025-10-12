import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/playerStore";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function YouTubePlayer() {
  const playerRef = useRef<any>(null);
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    isRepeat,
    audioOnlyMode,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    playNext,
  } = usePlayerStore();

  useEffect(() => {
    // Load YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    };
  }, []);

  useEffect(() => {
    if (currentTrack?.source === 'youtube' && currentTrack.youtubeId && playerRef.current) {
      playerRef.current.loadVideoById(currentTrack.youtubeId);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.playVideo) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(isMuted ? 0 : volume * 100);
    }
  }, [volume, isMuted]);

  const onPlayerReady = (event: any) => {
    setDuration(event.target.getDuration());
    
    // Update current time periodically
    setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 1000);
  };

  const onPlayerStateChange = (event: any) => {
    if (event.data === window.YT.PlayerState.ENDED) {
      if (isRepeat) {
        playerRef.current.seekTo(0);
        playerRef.current.playVideo();
      } else {
        playNext();
      }
    } else if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false);
    }
  };

  return (
    <div
      id="youtube-player"
      className={audioOnlyMode ? "hidden" : "fixed bottom-28 right-4 z-40"}
    />
  );
}
