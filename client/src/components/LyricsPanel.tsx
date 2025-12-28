import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Music, Upload, FileText, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlayerStore } from "@/lib/playerStore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LrcLine {
  time: number;
  text: string;
}

export function LyricsPanel() {
  const { currentTrack, currentTime } = usePlayerStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for manually uploaded lyrics
  const [customLyrics, setCustomLyrics] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<LrcLine[] | null>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  // Reset custom lyrics when track changes
  useEffect(() => {
    setCustomLyrics(null);
    setSyncedLyrics(null);
  }, [currentTrack?.id]);

  // Fetch API Lyrics (Auto)
  const { data: apiData, isLoading } = useQuery<{ lyrics: string }>({
    queryKey: ["/api/lyrics", currentTrack?.title, currentTrack?.artist],
    enabled: !!currentTrack && !customLyrics, // Only fetch if no custom lyrics
    queryFn: async () => {
      if (!currentTrack) return { lyrics: null };
      const response = await fetch(
        `/api/lyrics?title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist || '')}`
      );
      return response.json();
    },
  });

  // Determine which lyrics to show
  const lyricsText = customLyrics || apiData?.lyrics;
  const isSynced = !!syncedLyrics;

  // --- PARSING LOGIC ---
  
  const parseLrc = (content: string): LrcLine[] => {
    const lines = content.split('\n');
    const result: LrcLine[] = [];
    // Regex for standard LRC timestamps: [mm:ss.xx] or [mm:ss.xxx]
    const timeRegex = /\[(\d{2}):(\d{2})(\.(\d{2,3}))?\]/;

    for (const line of lines) {
      const match = line.match(timeRegex);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = match[4] ? parseInt(match[4].padEnd(3, '0'), 10) : 0;
        const time = minutes * 60 + seconds + milliseconds / 1000;
        const text = line.replace(timeRegex, '').trim();
        
        // Only add lines that actually have text
        if (text) {
            result.push({ time, text });
        }
      }
    }
    return result.sort((a, b) => a.time - b.time);
  };

  // --- HANDLERS ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        // Try to parse as LRC first
        const parsed = parseLrc(content);
        
        if (parsed.length > 0) {
          setSyncedLyrics(parsed);
          setCustomLyrics(null); // Clear static text mode
          toast({ 
            title: "Synced Lyrics Loaded", 
            description: "Lyrics successfully matched with audio timestamps." 
          });
        } else {
          // Fallback to plain text if no timestamps found
          setCustomLyrics(content);
          setSyncedLyrics(null);
          toast({ 
            title: "Lyrics Uploaded", 
            description: "Loaded as plain text (no timestamps found)." 
          });
        }
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    e.target.value = ""; 
  };

  // --- AUTO SCROLL LOGIC ---
  
  // Find index of currently playing line
  const activeIndex = syncedLyrics?.findIndex((line, index) => {
    const nextLine = syncedLyrics[index + 1];
    // Active if current time is past line start AND before next line start
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  }) ?? -1;

  // Scroll active line into view when index changes
  useEffect(() => {
    if (activeLineRef.current) {
        activeLineRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    }
  }, [activeIndex]);


  // --- RENDER ---

  if (!currentTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <Music className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-foreground mb-2">No track playing</h3>
        <p className="text-sm text-muted-foreground">Play a song to view or upload lyrics</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
      {/* Header Actions */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
        <div>
            <h2 className="text-sm font-semibold text-foreground/90 truncate max-w-[200px]">
            {currentTrack.title}
            </h2>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
            {currentTrack.artist || 'Unknown Artist'}
            </p>
        </div>
        <div className="flex items-center gap-2">
            <input
                type="file"
                accept=".lrc,.txt"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
            />
            <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="h-3 w-3" />
                Upload Lyrics
            </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col items-center py-10 px-6 min-h-full">
            {isLoading && !customLyrics ? (
                <div className="flex flex-col items-center justify-center h-40 opacity-70">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <span className="text-xs text-muted-foreground">Fetching lyrics...</span>
                </div>
            ) : isSynced && syncedLyrics ? (
                // --- SYNCED VIEW (ANIMATED) ---
                <div className="w-full max-w-xl space-y-6 transition-all">
                    {syncedLyrics.map((line, index) => {
                        const isActive = index === activeIndex;
                        return (
                            <p
                                key={index}
                                ref={isActive ? activeLineRef : null}
                                className={cn(
                                    "text-center transition-all duration-500 ease-out cursor-default select-none py-2",
                                    isActive 
                                        ? "text-2xl md:text-3xl font-bold text-primary scale-105 opacity-100" 
                                        : "text-lg text-muted-foreground/50 blur-[0.5px] hover:blur-none hover:text-foreground/80 hover:opacity-100"
                                )}
                            >
                                {line.text}
                            </p>
                        );
                    })}
                </div>
            ) : lyricsText ? (
                // --- STATIC TEXT VIEW ---
                <div className="w-full max-w-xl space-y-4">
                    {lyricsText.split('\n').map((line, index) => (
                        <p
                            key={index}
                            className="text-lg text-foreground/90 text-center leading-relaxed"
                        >
                            {line || '\u00A0'}
                        </p>
                    ))}
                </div>
            ) : (
                // --- EMPTY STATE ---
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-80">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Lyrics Found</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mt-2 mb-6">
                        We couldn't automatically find lyrics for this track. You can upload your own file to get started.
                    </p>
                    <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border/50">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>Tip: Upload a <b>.lrc</b> file for synced playback!</span>
                    </div>
                </div>
            )}
        </div>
      </ScrollArea>
    </div>
  );
}