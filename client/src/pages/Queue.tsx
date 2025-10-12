import { X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePlayerStore } from "@/lib/playerStore";
import type { Track } from "@shared/schema";

export default function Queue() {
  const { queue, currentTrack, removeFromQueue, setCurrentTrack, setQueue, clearQueue } = usePlayerStore();

  const handlePlay = (track: Track, index: number) => {
    setCurrentTrack(track);
    // Reorder queue so clicked track is first
    const newQueue = [track, ...queue.filter((_, i) => i !== index)];
    setQueue(newQueue);
  };

  const handleRemove = (index: number) => {
    removeFromQueue(index);
  };

  return (
    <div className="min-h-screen pb-32 px-6 pt-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-queue-title">Queue</h1>
            <p className="text-muted-foreground mt-1">
              {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
            </p>
          </div>
          {queue.length > 0 && (
            <Button
              variant="outline"
              onClick={clearQueue}
              data-testid="button-clear-queue"
            >
              Clear Queue
            </Button>
          )}
        </div>

        {currentTrack && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
              Now Playing
            </h2>
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-3">
                <img
                  src={currentTrack.thumbnail || '/placeholder.svg'}
                  alt={currentTrack.title}
                  className="w-12 h-12 rounded-md object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {currentTrack.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {currentTrack.artist || 'Unknown Artist'}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            Up Next
          </h2>
          {queue.length > 0 ? (
            <div className="space-y-2">
              {queue.map((track, index) => (
                <Card
                  key={`${track.id}-${index}`}
                  className="p-3 hover-elevate active-elevate-2 group"
                  data-testid={`queue-item-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <GripVertical className="h-4 w-4" />
                    </Button>

                    <img
                      src={track.thumbnail || '/placeholder.svg'}
                      alt={track.title}
                      className="w-12 h-12 rounded-md object-cover flex-shrink-0 cursor-pointer"
                      onClick={() => handlePlay(track, index)}
                    />

                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handlePlay(track, index)}
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {track.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {track.artist || 'Unknown Artist'}
                      </p>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemove(index)}
                      className="h-8 w-8"
                      data-testid={`button-remove-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Queue is empty</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
