import { useQuery, useMutation } from "@tanstack/react-query";
import { SearchBar } from "@/components/SearchBar";
import { TrackCard } from "@/components/TrackCard";
import { usePlayerStore } from "@/lib/playerStore";
import type { Track } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const { setCurrentTrack, setQueue, addToQueue } = usePlayerStore();

  const { data: trending, isLoading } = useQuery<Track[]>({
    queryKey: ["/api/youtube/trending"],
  });

  const addToHistoryMutation = useMutation({
    mutationFn: async (track: Track) => {
      if (track.youtubeId) {
        await apiRequest("POST", "/api/history", {
          youtubeId: track.youtubeId,
          title: track.title,
          artist: track.artist,
          thumbnail: track.thumbnail,
          duration: track.duration,
        });
      }
    },
  });

  const handleSearchSelect = (result: any) => {
    const track: Track = {
      id: result.id,
      youtubeId: result.id,
      title: result.title,
      artist: result.artist,
      thumbnail: result.thumbnail,
      duration: result.duration,
      source: 'youtube',
    };
    setCurrentTrack(track);
    setQueue([track]);
    addToHistoryMutation.mutate(track);
  };

  const handlePlay = (track: Track) => {
    setCurrentTrack(track);
    if (trending) {
      setQueue(trending);
    }
    addToHistoryMutation.mutate(track);
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
  };

  return (
    <div className="min-h-screen pb-32">
      {/* Hero Section with Search */}
      <div className="relative bg-gradient-to-b from-primary/20 via-background to-background pt-16 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-center">
            Find Your Music
          </h1>
          <div className="flex justify-center">
            <SearchBar onSelectResult={handleSearchSelect} className="w-full" />
          </div>
        </div>
      </div>

      {/* Trending Section */}
      <div className="max-w-7xl mx-auto px-6 -mt-12">
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          Trending Now
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : trending && trending.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {trending.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                onPlay={handlePlay}
                onAddToQueue={handleAddToQueue}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-muted-foreground">No trending tracks available</p>
          </div>
        )}
      </div>

      {/* Recently Played */}
      <div className="max-w-7xl mx-auto px-6 mt-12">
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          Continue Listening
        </h2>
        <div className="text-center py-12 text-muted-foreground">
          Your recently played tracks will appear here
        </div>
      </div>
    </div>
  );
}
