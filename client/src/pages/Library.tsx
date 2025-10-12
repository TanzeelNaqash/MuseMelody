import { useQuery } from "@tanstack/react-query";
import { Plus, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Playlist } from "@shared/schema";

export default function Library() {
  const { user } = useAuth();

  const { data: playlists, isLoading } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
    enabled: !!user,
  });

  return (
    <div className="min-h-screen pb-32 px-6 pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Your Library</h1>
          <Button
            onClick={() => window.location.href = '/create-playlist'}
            data-testid="button-create-playlist"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Playlist
          </Button>
        </div>

        {/* Playlists */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">Playlists</h2>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : playlists && playlists.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {playlists.map((playlist) => (
                <Card
                  key={playlist.id}
                  className="p-4 hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => window.location.href = `/playlist/${playlist.id}`}
                  data-testid={`playlist-card-${playlist.id}`}
                >
                  <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg mb-3 flex items-center justify-center">
                    <Music className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="font-medium text-foreground truncate">
                    {playlist.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {playlist.description || 'No description'}
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No playlists yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Create your first playlist to organize your music
              </p>
              <Button
                onClick={() => window.location.href = '/create-playlist'}
                data-testid="button-create-first-playlist"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Playlist
              </Button>
            </Card>
          )}
        </div>

        {/* Uploaded Files */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Uploaded Music</h2>
          <Card className="p-12 text-center">
            <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Upload your music
            </h3>
            <p className="text-muted-foreground mb-6">
              Add your personal music collection to stream anywhere
            </p>
            <Button
              onClick={() => window.location.href = '/upload'}
              data-testid="button-upload-music"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload Music
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
