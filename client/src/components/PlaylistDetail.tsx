import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Play, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrackCard } from "@/components/TrackCard";
import { useLocation, useRoute } from "wouter";
import { usePlayerStore } from "@/lib/playerStore";
import { apiRequest } from "@/lib/queryClient";
import type { Track } from "@shared/schema";

export default function PlaylistDetail() {
  const [, params] = useRoute("/playlist/:id");
  const [, navigate] = useLocation();
  const playlistId = params?.id;
  
  const { setCurrentTrack, setQueue, addToQueue } = usePlayerStore();
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";

  // Fetch playlist details
  const { data: playlist, isLoading } = useQuery<any>({
    queryKey: ["/api/featured-playlist", playlistId],
    queryFn: async () => {
      // We can reuse the existing endpoint but pass the ID directly if modified, 
      // or we can use the 'piped' search logic. 
      // Since your backend endpoint '/api/featured-playlist' takes a 'query',
      // we might need a dedicated endpoint for fetching by ID or just use the tracks endpoint.
      
      // OPTION A: If it's a "featured" playlist (from Youtube), we likely need a new way to get it by ID
      // However, your backend currently fetches by "category". 
      // To support fetching a SPECIFIC playlist by ID (like RDCL...), let's use a direct fetch.
      
      // Let's assume we can fetch playlist details by ID using a new or existing endpoint.
      // Since we don't have a direct "get playlist by ID" for external youtube lists exposed yet 
      // (except deeply nested in search), let's simulate it or add it.
      
      // WORKAROUND: For now, let's use a specific endpoint or modify the backend.
      // BUT, looking at your backend code, you have:
      // app.get('/api/playlists/:id/tracks') -> for local DB playlists
      // We need one for EXTERNAL playlists.
      
      // Let's try to fetch it via the piped proxy if available, or just use the same 
      // logic you used in the backend for "featured-playlists" but for a single ID.
      
      const res = await fetch(`${API_URL}/api/proxy/playlist/${playlistId}`); 
      // *Note: We need to ensure this endpoint exists or create it. See Step 2.*
      
      if (!res.ok) throw new Error("Failed to fetch playlist");
      return res.json();
    },
    enabled: !!playlistId,
  });

  const handlePlayTrack = async (track: Track) => {
    setCurrentTrack(track);
    if (playlist?.tracks) {
      setQueue(playlist.tracks);
    } else {
      setQueue([track]);
    }
    
    if (track.youtubeId) {
      try {
        await apiRequest("POST", "/api/history", {
          youtubeId: track.youtubeId,
          title: track.title,
          artist: track.artist,
          thumbnail: track.thumbnail,
          duration: track.duration,
        });
      } catch (error) { console.warn("Failed to record history", error); }
    }
  };

  const handleAddToQueue = (track: Track) => addToQueue(track);

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status"></div>
          <p className="mt-4 text-muted-foreground">Loading playlist...</p>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen p-8">
        <Button variant="ghost" onClick={() => navigate("/library")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Library
        </Button>
        <Card className="p-12 text-center">
          <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Playlist not found</h3>
          <p className="text-muted-foreground">The playlist you're looking for doesn't exist or failed to load.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 px-4 sm:px-6 pt-4 sm:pt-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/library")} className="mb-6 hover:bg-background/50">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Library
        </Button>

        <Card className="p-6 sm:p-8 bg-gradient-to-r from-primary/10 to-transparent border-l-4 border-l-primary mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-48 h-48 flex-shrink-0 rounded-lg overflow-hidden shadow-lg mx-auto sm:mx-0">
              <img 
                src={playlist.thumbnailUrl || "/placeholder-music.png"} 
                alt={playlist.title} 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 truncate">{playlist.title}</h1>
              {playlist.description && (
                <p className="text-muted-foreground mb-4 line-clamp-2">{playlist.description}</p>
              )}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                <Button size="lg" onClick={() => handlePlayTrack(playlist.tracks[0])} className="w-full sm:w-auto">
                  <Play className="h-5 w-5 mr-2" fill="currentColor" /> Play All
                </Button>
                <div className="text-sm text-muted-foreground">
                  {playlist.videoCount || playlist.tracks.length} songs • {playlist.uploaderName || "Unknown"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground px-1">Tracks</h2>
          <div className="grid gap-3 sm:gap-4 md:gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {playlist.tracks && playlist.tracks.map((track: Track) => (
              <TrackCard 
                key={track.id} 
                className="h-full hover:bg-accent/50 transition-colors" 
                track={track} 
                onPlay={handlePlayTrack} 
                onAddToQueue={handleAddToQueue} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}