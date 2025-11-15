import { useQuery } from "@tanstack/react-query";
import { Plus, Music, Download, FolderOpen, Search, LogIn, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import type { Playlist, UploadedFile, Track } from "@shared/schema";

export default function Library() {
  const { t } = useTranslation();
  const { user, isGuest } = useAuth();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString ?? '');
  const section = urlParams.get('section') ?? 'playlists';

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
              {t('library.signInToAccess')}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

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
    enabled: !!user,
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
    enabled: !!user,
  });

  return (
    <div className="min-h-screen pb-32 px-6 pt-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">{t('library.title')}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/upload'}>
              <Plus className="h-4 w-4 mr-2" />
              {t('navigation.uploadMusic')}
            </Button>
            <Button onClick={() => window.location.href = '/create-playlist'}>
              <Plus className="h-4 w-4 mr-2" />
              {t('navigation.createPlaylist')}
            </Button>
          </div>
        </div>

        {/* Library Sections */}
        <Tabs value={section} onValueChange={(value) => {
          const url = new URL(window.location.href);
          url.searchParams.set('section', value);
          window.history.pushState({}, '', url.toString());
          window.location.reload();
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="playlists" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              {t('library.playlists')}
            </TabsTrigger>
            <TabsTrigger value="local" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              {t('library.localFiles')}
            </TabsTrigger>
            <TabsTrigger value="downloads" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {t('library.downloads')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playlists" className="space-y-6">
            {loadingPlaylists ? (
              <div className="text-center py-12 text-muted-foreground">{t('library.loadingPlaylists')}</div>
            ) : playlists && playlists.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {playlists.map((playlist) => (
                  <Card
                    key={playlist.id}
                    className="p-4 hover:scale-105 transition-transform cursor-pointer group"
                    onClick={() => window.location.href = `/playlist/${playlist.id}`}
                  >
                    <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg mb-3 flex items-center justify-center group-hover:shadow-lg transition-shadow">
                      <Music className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="font-medium text-foreground truncate">{playlist.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{playlist.description || 'No description'}</p>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{t('library.noPlaylistsYet')}</h3>
                <p className="text-muted-foreground mb-6">{t('library.createFirstPlaylist')}</p>
                <Button onClick={() => window.location.href = '/create-playlist'}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('navigation.createPlaylist')}
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="local" className="space-y-6">
            {loadingUploads ? (
              <div className="text-center py-12 text-muted-foreground">{t('library.loadingLocalFiles')}</div>
            ) : uploadedFiles && uploadedFiles.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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
                <Button onClick={() => window.location.href = '/upload'}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('navigation.uploadMusic')}
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="downloads" className="space-y-6">
            <Card className="p-12 text-center">
              <Download className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">{t('library.noDownloadsYet')}</h3>
              <p className="text-muted-foreground mb-6">{t('library.downloadMusicFromYouTube')}</p>
              <Button variant="outline" onClick={() => window.location.href = '/search'}>
                <Search className="h-4 w-4 mr-2" />
                {t('library.searchAndDownload')}
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
