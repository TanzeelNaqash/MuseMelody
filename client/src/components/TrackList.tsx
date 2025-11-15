import { Play, Plus, MoreVertical, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Track } from "@shared/schema";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { addToFavorites, removeFromFavorites, isFavorite, getCollectionNames, addTrackToCollection } from "@/lib/libraryBridge";

interface TrackListProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
  showIndex?: boolean;
}

export function TrackList({ tracks, onPlay, onAddToQueue, onAddToPlaylist, showIndex = true }: TrackListProps) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [playlists, setPlaylists] = useState<string[]>([]);

  useEffect(() => {
    // Load favorites status for all tracks
    const favSet = new Set<string>();
    tracks.forEach(track => {
      if (isFavorite(track.youtubeId || track.id)) {
        favSet.add(track.youtubeId || track.id);
      }
    });
    setFavorites(favSet);
    setPlaylists(getCollectionNames());
  }, [tracks]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleToggleFavorite = (track: Track) => {
    const trackId = track.youtubeId || track.id;
    if (favorites.has(trackId)) {
      removeFromFavorites(trackId);
      setFavorites(prev => {
        const newSet = new Set(prev);
        newSet.delete(trackId);
        return newSet;
      });
    } else {
      addToFavorites(track);
      setFavorites(prev => new Set(prev).add(trackId));
    }
  };

  return (
    <div className="space-y-1">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          className="group flex items-center gap-3 px-4 py-2 rounded-lg hover-elevate active-elevate-2"
          data-testid={`track-item-${track.id}`}
        >
          {/* Index / Play Button */}
          <div className="w-8 flex items-center justify-center">
            <span className="text-sm text-muted-foreground group-hover:hidden">
              {showIndex ? index + 1 : ''}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onPlay(track)}
              className="h-8 w-8 hidden group-hover:flex"
              data-testid={`button-play-track-${track.id}`}
            >
              <Play className="h-4 w-4" fill="currentColor" />
            </Button>
          </div>

          {/* Thumbnail */}
          <img
            src={track.thumbnail || '/placeholder.svg'}
            alt={track.title}
            className="w-12 h-12 rounded-md object-cover flex-shrink-0"
          />

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate" data-testid={`text-title-${track.id}`}>
              {track.title}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {track.artist || 'Unknown Artist'}
            </p>
          </div>

          {/* Duration */}
          <span className="text-sm text-muted-foreground">
            {formatDuration(track.duration)}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleToggleFavorite(track)}
              className={cn("h-8 w-8", favorites.has(track.youtubeId || track.id) && "text-primary")}
              data-testid={`button-favorite-${track.id}`}
            >
              <Heart className={cn("h-4 w-4", favorites.has(track.youtubeId || track.id) && "fill-current")} />
            </Button>
            
            {onAddToQueue && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onAddToQueue(track)}
                className="h-8 w-8"
                data-testid={`button-queue-${track.id}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-options-${track.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onPlay(track)}>
                  Play Now
                </DropdownMenuItem>
                {onAddToQueue && (
                  <DropdownMenuItem onClick={() => onAddToQueue(track)}>
                    Add to Queue
                  </DropdownMenuItem>
                )}
                {onAddToPlaylist && (
                  <DropdownMenuItem onClick={() => onAddToPlaylist(track)}>
                    Add to Playlist
                  </DropdownMenuItem>
                )}
                {playlists.map((playlistName) => (
                  <DropdownMenuItem 
                    key={playlistName}
                    onClick={() => addTrackToCollection(playlistName, track)}
                  >
                    Add to {playlistName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}
