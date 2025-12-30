import { useQuery } from "@tanstack/react-query";
import { Plus, Music, FolderOpen, LogIn, Play, Sparkles, TrendingUp, Globe, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import type { Playlist, UploadedFile, Track } from "@shared/schema";

export default function Library() {
  const { t } = useTranslation();
  const { user, isGuest } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString ?? '');
  const section = urlParams.get('section') ?? 'playlists';
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";

  // --- QUERIES FOR 4 CATEGORIES ---
  const { data: hits2025, isLoading: loadingHits2025 } = useQuery<any[]>({
    queryKey: ["/api/featured-playlists", "hits-2025"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/featured-playlists?category=hits-2025`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const { data: indiaHits, isLoading: loadingIndiaHits } = useQuery<any[]>({
    queryKey: ["/api/featured-playlists", "india-hitlist"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/featured-playlists?category=india-hitlist`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const { data: intlHits, isLoading: loadingIntlHits } = useQuery<any[]>({
    queryKey: ["/api/featured-playlists", "international-hits-2025"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/featured-playlists?category=international-hits-2025`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const { data: globalHits, isLoading: loadingGlobalHits } = useQuery<any[]>({
    queryKey: ["/api/featured-playlists", "todays-global-hits"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/featured-playlists?category=todays-global-hits`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });
  // -------------------------------------

  // 1. Fetch User Playlists
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

  // 2. Fetch Metadata (Tracks count & Thumbnail) for each playlist
  const { data: playlistsMetadata, isLoading: loadingMetadata } = useQuery<Record<string, { thumbnail?: string; count: number }>>({
    // FIX: Changed key to ["/api/playlists/tracks", "metadata"]
    // This allows invalidating ["/api/playlists/tracks"] to automatically refetch this query too.
    queryKey: ["/api/playlists/tracks", "metadata", playlists?.map(p => p.id).join(',')], 
    queryFn: async () => {
      if (!playlists || playlists.length === 0) return {};
      
      const results: Record<string, { thumbnail?: string; count: number }> = {};
      
      // Parallel fetch for all playlists
      await Promise.all(
        playlists.map(async (playlist) => {
          try {
            const res = await fetch(`${API_URL}/api/playlists/${playlist.id}/tracks`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
            });
            
            if (res.ok) {
              const tracks: Track[] = await res.json();
              // Find the first track that has a valid thumbnail
              const firstWithThumb = tracks.find(t => t.thumbnail && t.thumbnail.length > 0);
              
              results[playlist.id] = {
                thumbnail: firstWithThumb?.thumbnail,
                count: tracks.length,
              };
            } else {
              results[playlist.id] = { count: 0 };
            }
          } catch (error) {
            console.error(`Failed to load tracks for playlist ${playlist.id}`, error);
            results[playlist.id] = { count: 0 };
          }
        })
      );
      
      return results;
    },
    enabled: !!playlists && playlists.length > 0, 
  });

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

  const isPersonalPlaylistsLoading = loadingPlaylists || (playlists && playlists.length > 0 && loadingMetadata);

  if (isGuest) {
    return (
      <div className="min-h-screen pb-32 px-6 pt-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">{t('library.title')}</h1>
          <Card className="p-12 text-center">
            <Alert className="mb-6">
              <LogIn className="h-4 w-4" />
              <AlertDescription>{t('library.requiresAccount')}</AlertDescription>
            </Alert>
            <Button onClick={() => { localStorage.removeItem('auth_token'); localStorage.removeItem('auth_user'); window.location.reload(); }} className="w-full max-w-md">{t('auth.signIn')}</Button>
          </Card>
        </div>
      </div>
    );
  }

  // Reusable Component for Featured Section
  const FeaturedSection = ({ title, icon: Icon, data, isLoading }: { title: string, icon: any, data: any[] | undefined, isLoading: boolean }) => (
    <div className="mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
        </div>
        
        {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {[1,2,3,4].map(i => (
                    <div key={i} className="aspect-square bg-muted/30 animate-pulse rounded-lg" />
                ))}
            </div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-4">
            {data?.slice(0, 5).map((playlist) => (
                <div 
                    key={playlist.id} 
                    onClick={() => navigate(`/playlist/${playlist.id}`)}
                    className="group cursor-pointer flex flex-col gap-2"
                >
                <div className="relative aspect-square rounded-lg overflow-hidden shadow-md transition-all duration-300 hover:shadow-xl hover:scale-105">
                    <img 
                        src={playlist.thumbnailUrl || "/placeholder-music.png"} 
                        alt={playlist.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Play className="h-10 w-10 text-white fill-white" />
                    </div>
                </div>
                <div className="space-y-0.5">
                    <h3 className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">{playlist.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{playlist.videoCount} songs • {playlist.uploaderName}</p>
                </div>
                </div>
            ))}
            </div>
        )}
    </div>
  );

  return (
    <div className="min-h-screen pb-32 px-4 sm:px-6 pt-4 sm:pt-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('library.title')}</h1>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
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

        {/* Library Sections */}
        <Tabs value={section} onValueChange={(value) => navigate(`/library?section=${value}`)} className="w-full mb-12">
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-8">
            <TabsTrigger value="playlists" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4"><Music className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{t('library.playlists')}</span></TabsTrigger>
            <TabsTrigger value="local" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4"><FolderOpen className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{t('library.localFiles')}</span></TabsTrigger>
          </TabsList>

          <TabsContent value="playlists" className="space-y-4 sm:space-y-6">
            {isPersonalPlaylistsLoading ? (
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {[1,2,3,4].map(i => (
                      <div key={i} className="aspect-square bg-muted/30 animate-pulse rounded-lg" />
                  ))}
               </div>
            ) : playlists && playlists.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {playlists.map((playlist) => {
                  const metadata = playlistsMetadata?.[playlist.id];
                  const thumbnail = metadata?.thumbnail;
                  const trackCount = metadata?.count ?? 0;
                  
                  return (
                  <Card 
                    key={playlist.id} 
                    className="p-2 sm:p-4 hover:scale-105 transition-transform cursor-pointer group" 
                    onClick={() => navigate(`/playlist/${playlist.id}`)}
                  >
                      <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg mb-2 sm:mb-3 flex items-center justify-center group-hover:shadow-lg transition-shadow overflow-hidden relative">
                        {thumbnail ? (
                            <img src={thumbnail} alt={playlist.name} className="w-full h-full object-cover rounded-lg" loading="lazy" />
                        ) : (
                            <Music className="h-8 w-8 sm:h-12 sm:w-12 text-primary" />
                        )}
                        
                        {trackCount > 0 && (
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Music className="h-3 w-3" />
                                <span>{trackCount}</span>
                            </div>
                        )}
                        
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg">
                            <Play className="h-10 w-10 text-white fill-white" />
                        </div>
                    </div>
                      <h3 className="font-medium text-foreground truncate text-sm sm:text-base">{playlist.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 truncate hidden sm:block">{playlist.description || `${trackCount} tracks`}</p>
                  </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{t('library.noPlaylistsYet')}</h3>
                <p className="text-muted-foreground mb-6">{t('library.createFirstPlaylist')}</p>
                <Button onClick={() => navigate('/create-playlist')}><Plus className="h-4 w-4 mr-2" />{t('navigation.createPlaylist')}</Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="local" className="space-y-4 sm:space-y-6">
            {loadingUploads ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm sm:text-base">{t('library.loadingLocalFiles')}</div>
            ) : uploadedFiles && uploadedFiles.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {uploadedFiles.map((file) => (
                    <Card key={file.id} className="p-4 hover:scale-105 transition-transform group cursor-pointer" onClick={async () => { const { playTrack } = await import("@/lib/playerBridge"); await playTrack({ id: file.id, title: file.title ?? "Untitled", artist: file.artist ?? undefined, source: 'local', fileUrl: `/api/uploads/${file.id}/stream` }); }}>
                      <div className="aspect-square bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-lg mb-3 flex items-center justify-center relative">
                        <Music className="h-12 w-12 text-green-500" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100"><Play className="h-8 w-8 text-white" fill="currentColor" /></div>
                      </div>
                      <h3 className="font-medium text-foreground truncate">{file.title}</h3>
                      <div className="mt-2"><span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Local</span></div>
                    </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{t('library.noLocalFilesYet')}</h3>
                <Button onClick={() => navigate('/upload')}><Plus className="h-4 w-4 mr-2" />{t('navigation.uploadMusic')}</Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <FeaturedSection title="This Year in Music" icon={Sparkles} data={hits2025} isLoading={loadingHits2025} />
        <FeaturedSection title="India's Biggest Hits" icon={TrendingUp} data={indiaHits} isLoading={loadingIndiaHits} />
        <FeaturedSection title="International Hits of 2025" icon={Globe} data={intlHits} isLoading={loadingIntlHits} />
        <FeaturedSection title="Today's Global Hits" icon={Radio} data={globalHits} isLoading={loadingGlobalHits} />
      </div>
    </div>
  );
}