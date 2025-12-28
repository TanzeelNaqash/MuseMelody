import { useQuery } from "@tanstack/react-query";
import { Plus, Music, FolderOpen, LogIn, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrackCard } from "@/components/TrackCard";
import { useAuth } from "@/hooks/useAuth";
import { useSearch, useLocation } from "wouter"; // Added useLocation
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { usePlayerStore } from "@/lib/playerStore";
import { apiRequest } from "@/lib/queryClient";
import type { Playlist, UploadedFile, Track } from "@shared/schema";

export default function Library() {
  const { t } = useTranslation();
  const { user, isGuest } = useAuth();
  
  // Navigation hooks
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  
  const urlParams = new URLSearchParams(searchString ?? '');
  const section = urlParams.get('section') ?? 'playlists';
  
  const { setCurrentTrack, setQueue, addToQueue } = usePlayerStore();

  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";

  // Playlists query
  const { data: playlists, isLoading: loadingPlaylists } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/playlists`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch playlists");
      return res.json();
    },
    enabled: !!user && !isGuest,
  });

  // Fetch tracks for each playlist
  const { data: playlistsWithTracks } = useQuery<Record<string, { thumbnail?: string; count: number }>>({
    queryKey: ["/api/playlists/tracks", playlists?.map(p => p.id)],
    queryFn: async () => {
      if (!playlists || playlists.length === 0) return {};
      const results: Record<string, { thumbnail?: string; count: number }> = {};
      await Promise.all(
        playlists.map(async (playlist) => {
          try {
            const res = await fetch(`${API_URL}/api/playlists/${playlist.id}/tracks`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
            });
            if (res.ok) {
              const tracks = await res.json();
              const firstTrack = tracks[0];
              results[playlist.id] = {
                thumbnail: firstTrack?.thumbnail,
                count: tracks.length,
              };
            } else {
              results[playlist.id] = { count: 0 };
            }
          } catch (error) {
            results[playlist.id] = { count: 0 };
          }
        })
      );
      return results;
    },
    enabled: !!user && !isGuest && !!playlists && playlists.length > 0,
  });

  // Uploaded files query
  const { data: uploadedFiles, isLoading: loadingUploads } = useQuery<UploadedFile[]>({
    queryKey: ["/api/uploads"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/uploads`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch uploaded files");
      return res.json();
    },
    enabled: !!user && !isGuest,
  });

  // Featured playlists
  const featuredPlaylistsList = [
    { id: 'hindi-essentials', name: 'Hindi Essentials', searchQuery: 'hindi essentials playlist' },
    { id: 'hip-hop-essentials', name: 'Hip Hop Essentials', searchQuery: 'hip hop essentials playlist' },
    { id: 'classical', name: 'Classical', searchQuery: 'classical music playlist' },
    { id: 'english', name: 'English Hits', searchQuery: 'english hits playlist' },
    { id: 'punjabi', name: 'Punjabi Hits', searchQuery: 'punjabi hits playlist' },
    { id: 'mix-hits', name: 'Mix Hits', searchQuery: 'mix hits playlist' },
    { id: 'electronics', name: 'Electronics', searchQuery: 'electronic music playlist' },
    { id: 'kpop', name: 'K-Pop', searchQuery: 'kpop playlist' },
  ];

  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);

  // Featured playlist query
  const { data: selectedPlaylistData, isLoading: loadingFeatured } = useQuery<any>({
    queryKey: ["/api/featured-playlist", selectedPlaylist],
    queryFn: async () => {
      if (!selectedPlaylist) return null;
      const playlist = featuredPlaylistsList.find(p => p.id === selectedPlaylist);
      if (!playlist) return null;
      
      const res = await fetch(`${API_URL}/api/featured-playlist?query=${encodeURIComponent(playlist.searchQuery)}`);
      if (!res.ok) throw new Error("Failed to fetch featured playlist");
      return res.json();
    },
    enabled: !!selectedPlaylist,
  });

  const handlePlayTrack = async (track: Track) => {
    setCurrentTrack(track);
    if (selectedPlaylistData?.tracks && Array.isArray(selectedPlaylistData.tracks)) {
      setQueue(selectedPlaylistData.tracks);
    } else {
      setQueue([track]);
    }
    
    // Add to history
    if (track.youtubeId) {
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
    }
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
  };

  if (isGuest) {
    return (
      <div className="min-h-screen pb-32 px-6 pt-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">{t('library.title')}</h1>
          <Card className="p-12 text-center">
            <Alert className="mb-6">
              <LogIn className="h-4 w-4" />
              <AlertDescription>
                {t('library.requiresAccount')}
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
                window.location.reload();
              }}
              className="w-full max-w-md"
            >
              {t('auth.signIn')}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 px-4 sm:px-6 pt-4 sm:pt-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('library.title')}</h1>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* USE NAVIGATE INSTEAD OF RELOAD */}
            <Button variant="outline" onClick={() => navigate('/upload')} className="flex-1 sm:flex-initial text-sm sm:text-base">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('navigation.uploadMusic')}</span>
              <span className="sm:hidden">Upload</span>
            </Button>
            <Button onClick={() => navigate('/create-playlist')} className="flex-1 sm:flex-initial text-sm sm:text-base">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('navigation.createPlaylist')}</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>
        </div>

        {/* Featured Playlists Section */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Featured Playlists</h2>
          </div>
          
          {/* Playlist Buttons */}
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
            {featuredPlaylistsList.map((playlist) => (
              <Button
                key={playlist.id}
                variant={selectedPlaylist === playlist.id ? "default" : "outline"}
                onClick={() => setSelectedPlaylist(selectedPlaylist === playlist.id ? null : playlist.id)}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
              >
                <span className="hidden sm:inline">{playlist.name}</span>
                <span className="sm:hidden">{playlist.name.split(' ')[0]}</span>
              </Button>
            ))}
          </div>

          {/* Selected Playlist with Tracks */}
          {selectedPlaylist && (
            <div className="mt-4 sm:mt-6 space-y-6">
              {loadingFeatured ? (
                <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm sm:text-base">Loading playlist...</div>
              ) : selectedPlaylistData && selectedPlaylistData.tracks && selectedPlaylistData.tracks.length > 0 ? (
                <div className="space-y-6">
                  {/* Playlist Header Card */}
                  <Card className="p-4 sm:p-6">
                    <div className="flex items-start gap-4 sm:gap-6">
                      {/* Playlist Thumbnail */}
                      <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
                        {selectedPlaylistData.thumbnailUrl ? (
                          <img
                            src={selectedPlaylistData.thumbnailUrl}
                            alt={selectedPlaylistData.title}
                            className="w-full h-full object-cover"
                          />
                        ) : selectedPlaylistData.tracks[0]?.thumbnail ? (
                          <img
                            src={selectedPlaylistData.tracks[0].thumbnail}
                            alt={selectedPlaylistData.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="h-8 w-8 sm:h-12 sm:w-12 text-primary" />
                          </div>
                        )}
                      </div>
                      
                      {/* Playlist Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 truncate">
                          {selectedPlaylistData.title && selectedPlaylistData.title !== 'Unknown Playlist' 
                            ? selectedPlaylistData.title 
                            : featuredPlaylistsList.find(p => p.id === selectedPlaylist)?.name || 'Playlist'}
                        </h3>
                        {selectedPlaylistData.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{selectedPlaylistData.description}</p>
                        )}
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {selectedPlaylistData.uploaderName && <span className="mr-2">by {selectedPlaylistData.uploaderName}</span>}
                          <span>{selectedPlaylistData.tracks.length} {selectedPlaylistData.tracks.length === 1 ? 'track' : 'tracks'}</span>
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Tracks Grid */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Tracks ({selectedPlaylistData.tracks.length})
                    </h4>
                    <div
                      className="grid gap-3 sm:gap-4 md:gap-6"
                      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
                    >
                      {selectedPlaylistData.tracks.map((track: Track) => (
                        <TrackCard
                          key={track.id}
                          className="h-full"
                          track={track}
                          onPlay={handlePlayTrack}
                          onAddToQueue={handleAddToQueue}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : selectedPlaylistData ? (
                <Card className="p-12 text-center">
                  <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No tracks found</h3>
                  <p className="text-muted-foreground">This playlist appears to be empty</p>
                </Card>
              ) : (
                <Card className="p-12 text-center">
                  <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Playlist not found</h3>
                  <p className="text-muted-foreground">Try selecting a different playlist</p>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Library Sections */}
        <Tabs 
          value={section} 
          onValueChange={(value) => {
            // FIX: Use navigate instead of window.location.reload()
            // This updates the URL and re-renders without refreshing the page
            navigate(`/library?section=${value}`);
          }} 
          className="w-full"
        >
          {/* UPDATED: Changed grid-cols-3 to grid-cols-2 */}
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-8">
            <TabsTrigger value="playlists" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
              <Music className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t('library.playlists')}</span>
              <span className="sm:hidden">Playlists</span>
            </TabsTrigger>
            <TabsTrigger value="local" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
              <FolderOpen className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t('library.localFiles')}</span>
              <span className="sm:hidden">Local</span>
            </TabsTrigger>
            {/* REMOVED DOWNLOADS TAB TRIGGER */}
          </TabsList>

          <TabsContent value="playlists" className="space-y-4 sm:space-y-6">
            {loadingPlaylists ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm sm:text-base">{t('library.loadingPlaylists')}</div>
            ) : playlists && playlists.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {playlists.map((playlist) => {
                  const playlistData = playlistsWithTracks?.[playlist.id];
                  const thumbnail = playlistData?.thumbnail;
                  const trackCount = playlistData?.count ?? 0;
                  
                  return (
                  <Card
                    key={playlist.id}
                      className="p-2 sm:p-4 hover:scale-105 transition-transform cursor-pointer group"
                    onClick={() => navigate(`/playlist/${playlist.id}`)}
                  >
                      <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg mb-2 sm:mb-3 flex items-center justify-center group-hover:shadow-lg transition-shadow overflow-hidden relative">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={playlist.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Music className="h-8 w-8 sm:h-12 sm:w-12 text-primary" />
                        )}
                        {trackCount > 0 && (
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Music className="h-3 w-3" />
                            <span>{trackCount}</span>
                          </div>
                        )}
                    </div>
                      <h3 className="font-medium text-foreground truncate text-sm sm:text-base">{playlist.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 truncate hidden sm:block">{playlist.description || `${trackCount} tracks`}</p>
                      {trackCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 sm:hidden">{trackCount} {trackCount === 1 ? 'track' : 'tracks'}</p>
                      )}
                  </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{t('library.noPlaylistsYet')}</h3>
                <p className="text-muted-foreground mb-6">{t('library.createFirstPlaylist')}</p>
                <Button onClick={() => navigate('/create-playlist')}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('navigation.createPlaylist')}
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="local" className="space-y-4 sm:space-y-6">
            {loadingUploads ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm sm:text-base">{t('library.loadingLocalFiles')}</div>
            ) : uploadedFiles && uploadedFiles.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {uploadedFiles.map((file) => {
                  const handlePlay = async () => {
                    const { playTrack } = await import("@/lib/playerBridge");
                    const track: Track = {
                      id: file.id,
                      title: file.title ?? file.originalName ?? "Untitled Track",
                      artist: file.artist ?? undefined,
                      thumbnail: undefined,
                      duration: undefined,
                      source: 'local',
                      fileUrl: `/api/uploads/${file.id}/stream`,
                    };
                    await playTrack(track);
                  };

                  return (
                    <Card 
                      key={file.id} 
                      className="p-4 hover:scale-105 transition-transform group cursor-pointer"
                      onClick={handlePlay}
                    >
                      <div className="aspect-square bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-lg mb-3 flex items-center justify-center group-hover:shadow-lg transition-shadow relative">
                        <Music className="h-12 w-12 text-green-500" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Play className="h-8 w-8 text-white" fill="currentColor" />
                        </div>
                      </div>
                      <h3 className="font-medium text-foreground truncate">{file.title}</h3>
                      <p className="text-xs text-muted-foreground truncate">{file.artist || "Unknown Artist"}</p>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Local
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{t('library.noLocalFilesYet')}</h3>
                <p className="text-muted-foreground mb-6">{t('library.uploadPersonalMusic')}</p>
                <Button onClick={() => navigate('/upload')}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('navigation.uploadMusic')}
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* REMOVED DOWNLOADS TABS CONTENT */}
        </Tabs>
      </div>
    </div>
  );
}