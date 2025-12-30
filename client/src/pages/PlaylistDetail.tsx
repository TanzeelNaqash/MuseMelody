import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Music, Loader2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrackCard } from "@/components/TrackCard";
import { useLocation, useRoute } from "wouter";
import { usePlayerStore } from "@/lib/playerStore";
import { apiRequest } from "@/lib/queryClient";
import type { Track } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function PlaylistDetail() {
  const [, params] = useRoute("/playlist/:id");
  const [, navigate] = useLocation();
  const playlistId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { setCurrentTrack, setQueue, addToQueue } = usePlayerStore();
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";

  // --- SMART FETCH: Tries Local DB first, falls back to YouTube Proxy ---
  const { data: playlistData, isLoading, error } = useQuery<any>({
    queryKey: ["playlist-smart-data", playlistId],
    queryFn: async () => {
      // 1. Try fetching from Local DB
      try {
        const localRes = await fetch(`${API_URL}/api/playlists/${playlistId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
        });
        
        if (localRes.ok) {
          const localInfo = await localRes.json();
          // Fetch tracks for local playlist
          const tracksRes = await fetch(`${API_URL}/api/playlists/${playlistId}/tracks`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
          });
          
          let tracks = tracksRes.ok ? await tracksRes.json() : [];
          
          // --- CRITICAL FIX START: Detect Local IDs vs YouTube IDs ---
          tracks = tracks.map((t: any) => {
              const id = t.youtubeId || t.id;
              // SAVE THE REAL DB ID BEFORE OVERWRITING IT
              const originalDbId = t.id; 

              // YouTube IDs are exactly 11 chars. Local Upload IDs are UUIDs.
              const isLocalId = id && id.length > 15; 

              if (t.fileUrl || isLocalId) {
                  return {
                      ...t,
                      id: id,
                      dbId: originalDbId, // <--- SAVED HERE
                      youtubeId: id, 
                      source: 'local', 
                      fileUrl: t.fileUrl || `/api/uploads/${id}/stream`
                  };
              }
              
              // Otherwise, it is a standard YouTube track
              return {
                  ...t,
                  id: id,
                  dbId: originalDbId, // <--- SAVED HERE
                  youtubeId: id,
                  source: 'youtube'
              };
          });
          // --- CRITICAL FIX END ---

          return {
            ...localInfo,
            tracks: tracks,
            isLocal: true, 
            title: localInfo.name, 
            thumbnailUrl: tracks.find((t: any) => t.thumbnail)?.thumbnail,
            uploaderName: "My Playlist"
          };
        }
      } catch (e) { /* Ignore and try proxy */ }

      // 2. If not found locally, fetch from YouTube Proxy
      const proxyRes = await fetch(`${API_URL}/api/proxy/playlist/${playlistId}`); 
      if (!proxyRes.ok) throw new Error("Playlist not found");
      const proxyData = await proxyRes.json();
      
      const externalTracks = (proxyData.tracks || []).map((t: any) => ({
          ...t,
          source: 'youtube'
      }));

      return { ...proxyData, tracks: externalTracks, isLocal: false };
    },
    enabled: !!playlistId,
    retry: false, 
  });

  // --- MUTATIONS ---
  const deletePlaylistMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/playlists/${playlistId}`);
    },
    onSuccess: () => {
      toast({ title: "Playlist deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      navigate("/library");
    },
  });

  const removeTrackMutation = useMutation({
    mutationFn: async (trackDbId: number) => {
      // Use the actual DB ID to delete from the backend
      await apiRequest("DELETE", `/api/playlists/${playlistId}/tracks/${trackDbId}`);
      return trackDbId; 
    },
    onSuccess: (_, trackDbIdToRemove) => {
      // 1. INSTANT UI UPDATE
      queryClient.setQueryData(["playlist-smart-data", playlistId], (oldData: any) => {
        if (!oldData || !oldData.tracks) return oldData;

        return {
          ...oldData,
          // Filter using the dbId we saved in the queryFn
          tracks: oldData.tracks.filter((t: any) => t.dbId !== trackDbIdToRemove)
        };
      });

      toast({ title: "Track removed" });
      
      // 2. Background Sync
      queryClient.invalidateQueries({ queryKey: ["playlist-smart-data", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists/tracks"] });
    },
  });

  const handlePlayTrack = async (track: Track) => {
    setCurrentTrack(track);
    if (playlistData?.tracks) {
      setQueue(playlistData.tracks);
    } else {
      setQueue([track]);
    }
    
    // Only record history for YouTube tracks
    if (track.source === 'youtube' && track.youtubeId) {
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
      <div className="min-h-screen p-8 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading playlist...</p>
      </div>
    );
  }

  if (error || !playlistData) {
    return (
      <div className="min-h-screen p-8">
        <Button variant="ghost" onClick={() => navigate("/library")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Library
        </Button>
        <Card className="p-12 text-center">
          <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Playlist not found</h3>
          <Button onClick={() => window.location.reload()} variant="outline">Try Again</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 px-4 sm:px-6 pt-4 sm:pt-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" onClick={() => navigate("/library")} className="hover:bg-background/50">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Library
            </Button>
            
            {playlistData.isLocal && (
                <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => {
                        if (confirm("Are you sure you want to delete this playlist?")) {
                            deletePlaylistMutation.mutate();
                        }
                    }}
                >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Playlist
                </Button>
            )}
        </div>

        <Card className="p-6 sm:p-8 bg-gradient-to-r from-primary/10 to-transparent border-l-4 border-l-primary mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-48 h-48 flex-shrink-0 rounded-lg overflow-hidden shadow-lg mx-auto sm:mx-0 bg-background/50 flex items-center justify-center">
              {playlistData.thumbnailUrl ? (
                  <img 
                    src={playlistData.thumbnailUrl} 
                    alt={playlistData.title} 
                    className="w-full h-full object-cover" 
                  />
              ) : (
                  <Music className="h-16 w-16 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 truncate">{playlistData.title}</h1>
              {playlistData.description && (
                <p className="text-muted-foreground mb-4 line-clamp-2 max-w-2xl">{playlistData.description}</p>
              )}
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                {playlistData.tracks && playlistData.tracks.length > 0 ? (
                    <Button size="lg" onClick={() => handlePlayTrack(playlistData.tracks[0])} className="w-full sm:w-auto">
                    <Play className="h-5 w-5 mr-2" fill="currentColor" /> Play All
                    </Button>
                ) : (
                    <Button size="lg" variant="outline" onClick={() => navigate("/search")} className="w-full sm:w-auto">
                        <Plus className="h-5 w-5 mr-2" /> Add Songs
                    </Button>
                )}
                
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                   <Music className="h-4 w-4" />
                   {playlistData.tracks?.length || 0} songs • {playlistData.uploaderName || "User"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
             <h2 className="text-lg font-semibold text-foreground">Tracks</h2>
             <span className="text-xs text-muted-foreground">{playlistData.tracks?.length || 0} items</span>
          </div>
          
          {(!playlistData.tracks || playlistData.tracks.length === 0) ? (
              <div className="text-center py-12 text-muted-foreground">
                  <p>This playlist is empty.</p>
                  {playlistData.isLocal && (
                      <p className="text-sm mt-2">Go to Search to find songs and add them here!</p>
                  )}
              </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 md:gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                {playlistData.tracks.map((track: any) => (
                <div key={track.dbId || track.id} className="relative group rounded-xl overflow-hidden">
                    <TrackCard 
                        className="h-full hover:bg-accent/50 transition-colors" 
                        track={track} 
                        onPlay={handlePlayTrack} 
                        onAddToQueue={handleAddToQueue} 
                    />
                    
                    {playlistData.isLocal && (
                        <div className="absolute top-2 right-2 z-20">
                            <Button
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation(); 
                                    // USE THE DB ID HERE
                                    removeTrackMutation.mutate(track.dbId);
                                }}
                                title="Remove from playlist"
                            >
                                <Trash2 className="h-4 w-4 text-white" />
                            </Button>
                        </div>
                    )}
                </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}