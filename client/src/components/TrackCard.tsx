import { Play, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Track } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TrackCardProps {
  track: Track;
  onPlay: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
  className?: string;
}

export function TrackCard({ track, onPlay, onAddToQueue, onAddToPlaylist, className }: TrackCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden hover-elevate active-elevate-2 transition-all duration-300",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`track-card-${track.id}`}
    >
      <div className="p-4">
        {/* Album Art with Play Overlay */}
        <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-muted">
          <img
            src={track.thumbnail || '/placeholder.svg'}
            alt={track.title}
            className="w-full h-full object-cover"
          />
          
          {isHovered && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Button
                size="icon"
                onClick={() => onPlay(track)}
                className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-xl transform scale-100 hover:scale-105 transition-transform"
                data-testid={`button-play-${track.id}`}
              >
                <Play className="h-6 w-6" fill="currentColor" />
              </Button>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="space-y-1">
          <h3 className="font-medium text-sm text-foreground truncate" data-testid={`text-track-title-${track.id}`}>
            {track.title}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {track.artist || 'Unknown Artist'}
          </p>
          {track.duration && (
            <p className="text-xs text-muted-foreground">
              {formatDuration(track.duration)}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-3 flex items-center gap-2">
          {onAddToQueue && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onAddToQueue(track)}
              className="flex-1"
              data-testid={`button-add-queue-${track.id}`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Queue
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-more-${track.id}`}>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
