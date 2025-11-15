import { Play, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Track } from "@shared/schema";

// Optional helper to handle thumbnails (if you have proxies)
const proxyThumbnail = (url?: string) => url || "/placeholder.svg";

interface TrackCardProps {
  track: Track;
  onPlay: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
  onClick?: () => void;
  className?: string;
}

export function TrackCard({
  track,
  onPlay,
  onAddToQueue,
  onAddToPlaylist,
  onClick,
  className,
}: TrackCardProps) {
  const { title, artist, thumbnail } = track;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl glass cursor-pointer p-3 sm:p-4 transition-all duration-300 hover-lift hover-glow",
        className,
      )}
    >
      {/* Thumbnail */}
      <div className="relative mb-4 aspect-square overflow-hidden rounded-xl bg-gradient-primary">
        {thumbnail ? (
          <img
            src={proxyThumbnail(thumbnail)}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className="h-16 w-16 text-white/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
        )}

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onPlay(track);
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary shadow-glow hover:scale-110 transition-transform"
          >
            <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
          </div>
        </div>

        {/* More Options Button */}
        {(onAddToQueue || onAddToPlaylist) && (
          <div
            className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 rounded-xl border border-border/60 bg-card/95 backdrop-blur"
              >
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
        )}
      </div>

      {/* Title + Artist */}
      <div className="space-y-1">
        <h3 className="truncate font-semibold text-foreground text-xs sm:text-sm">{title}</h3>
        <p className="truncate text-[0.7rem] sm:text-sm text-muted-foreground">
          {artist || "Unknown Artist"}
        </p>
      </div>
    </div>
  );
}
