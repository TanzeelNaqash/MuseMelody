import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { SearchModal, type SearchResult } from "@/components/SearchModal";
import { usePlayerStore } from "@/lib/playerStore";
import { apiRequest } from "@/lib/queryClient";
import type { Track } from "@shared/schema";
import { rememberStreamPreference } from "@/lib/streamPreferences";

export default function Search() {
  const { setCurrentTrack, setQueue } = usePlayerStore();
  const [, navigate] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(true);

  useEffect(() => {
    setIsModalOpen(true);
  }, []);

  const handleSelectResult = async (result: SearchResult) => {
    if (result.streamSource) {
      rememberStreamPreference(result.id, result.streamSource, result.streamInstance);
    }

    const track: Track = {
      id: result.id,
      youtubeId: result.id,
      title: result.title,
      artist: result.artist,
      thumbnail: result.thumbnailUrl,
      duration: result.duration,
      source: "youtube",
    };

    setCurrentTrack(track);
    setQueue([track]);
    try {
      await apiRequest("POST", "/api/history", {
        youtubeId: track.youtubeId,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        duration: track.duration,
      });
    } catch (error) {
      console.warn("Failed to record history", error);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    navigate("/");
  };

  return (
    <SearchModal
      isOpen={isModalOpen}
      onClose={handleClose}
              onSelectResult={handleSelectResult}
    />
  );
}
