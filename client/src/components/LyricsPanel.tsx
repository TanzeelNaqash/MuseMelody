import { useQuery } from "@tanstack/react-query";
import { Loader2, Music } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayerStore } from "@/lib/playerStore";

export function LyricsPanel() {
  const { currentTrack } = usePlayerStore();

  const { data: lyrics, isLoading } = useQuery<{ lyrics: string }>({
    queryKey: ["/api/lyrics", currentTrack?.title, currentTrack?.artist],
    enabled: !!currentTrack,
    queryFn: async () => {
      if (!currentTrack) return { lyrics: null };
      const response = await fetch(
        `/api/lyrics?title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist || '')}`
      );
      return response.json();
    },
  });

  if (!currentTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <Music className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No track playing</h3>
        <p className="text-sm text-muted-foreground">
          Play a song to see lyrics
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lyrics?.lyrics) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <Music className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No lyrics found</h3>
        <p className="text-sm text-muted-foreground">
          Lyrics unavailable for "{currentTrack.title}"
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-1" data-testid="text-lyrics-title">
            {currentTrack.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentTrack.artist || 'Unknown Artist'}
          </p>
        </div>
        
        <div className="space-y-6">
          {lyrics.lyrics.split('\n').map((line, index) => (
            <p
              key={index}
              className="text-base text-foreground leading-relaxed text-center transition-colors"
              data-testid={`lyrics-line-${index}`}
            >
              {line || '\u00A0'}
            </p>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
