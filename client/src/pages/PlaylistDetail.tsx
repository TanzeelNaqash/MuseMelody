import { useEffect } from "react";
import { useParams, useRouter } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, MoreVertical, ArrowLeft, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrackList } from "@/components/TrackList";
import { usePlayerStore } from "@/lib/playerStore";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Playlist, PlaylistTrack, Track } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentTrack, setQueue, addToQueue } = usePlayerStore();

  const { data: playlist } = useQuery<Playlist>({
    queryKey: ["/api/playlists", id],
    queryFn: () => fetch(`/api/playlists/${id}`).then(res => res.json()),
  });

  const { data: playlistTracks } = useQuery<PlaylistTrack[]>({
    queryKey: ["/api/playlists", id, "tracks"],
    queryFn: () => fetch(`/api/playlists/${id}/tracks`).then(res => res.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/playlists/${id}`, {});
    },
    onSuccess: () => {
      toast({ title: "Playlist deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      navigate("/library");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/api/login", 500);
        return;
      }
      toast({ title: "Failed to delete playlist", variant: "destructive" });
    },
  });

  const tracks: Track[] = playlistTracks?.map(pt => ({
    id: pt.id,
    youtubeId: pt.youtubeId,
    title: pt.title,
    artist: pt.artist,
    thumbnail: pt.thumbnail,
    duration: pt.duration,
    source: 'youtube' as const,
  })) || [];

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      setCurrentTrack(tracks[0]);
      setQueue(tracks);
    }
  };

  const handlePlay = (track: Track) => {
    setCurrentTrack(track);
    setQueue(tracks);
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
    toast({ title: "Added to queue" });
  };

  if (!playlist) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 px-6 pt-8">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/library")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>

        <div className="flex items-start gap-6 mb-8">
          <div className="w-48 h-48 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center flex-shrink-0">
            <Play className="h-24 w-24 text-primary" />
          </div>

          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground mb-2" data-testid="text-playlist-name">
              {playlist.name}
            </h1>
            {playlist.description && (
              <p className="text-muted-foreground mb-4">
                {playlist.description}
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-6">
              {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
            </p>

            <div className="flex items-center gap-3">
              <Button
                onClick={handlePlayAll}
                disabled={tracks.length === 0}
                data-testid="button-play-all"
              >
                <Play className="h-4 w-4 mr-2" fill="currentColor" />
                Play All
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-playlist-options">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => deleteMutation.mutate()} data-testid="menu-delete-playlist">
                    <Trash className="h-4 w-4 mr-2" />
                    Delete Playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {tracks.length > 0 ? (
          <Card className="p-4">
            <TrackList
              tracks={tracks}
              onPlay={handlePlay}
              onAddToQueue={handleAddToQueue}
            />
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              No tracks in this playlist yet
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
