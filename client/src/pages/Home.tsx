import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SearchBar } from "@/components/SearchBar";
import { SearchModal, type SearchResult } from "@/components/SearchModal";
import { TrackCard } from "@/components/TrackCard";
import { usePlayerStore } from "@/lib/playerStore";
import type { Track } from "@shared/schema";
import { Loader2, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useRef, useState } from "react";
import { rememberStreamPreference } from "@/lib/streamPreferences";

export default function Home() {
  const { t } = useTranslation();
  const { setCurrentTrack, setQueue, addToQueue } = usePlayerStore();
  const searchBarRef = useRef<HTMLDivElement>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  type StreamableTrack = Track & { streamSource?: 'piped' | 'invidious'; streamInstance?: string | null };

  const { data: trending, isLoading } = useQuery<StreamableTrack[]>(
    {
    queryKey: ["/api/trending"],
    queryFn: async () => {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${API_URL}/api/trending`,  { headers, credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trending");
      return res.json();
    },
  });

  const { data: recentHistory, isLoading: loadingHistory } = useQuery<StreamableTrack[]>(
    {
      queryKey: ["/api/history", "home"],
      queryFn: async () => {
        const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";
        const token = localStorage.getItem("auth_token");
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_URL}/api/history?limit=12`, {
          headers,
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch listening history");
        const history = await res.json();
        if (!Array.isArray(history)) return [];

        const deduped: Track[] = [];
        const seen = new Set<string>();

        for (const item of history) {
          const youtubeId: string | undefined = item.youtubeId ?? item.id;
          if (!youtubeId) continue;
          if (seen.has(youtubeId)) continue;
          seen.add(youtubeId);
          deduped.push({
            id: youtubeId,
            youtubeId,
            title: item.title,
            artist: item.artist,
            thumbnail: item.thumbnail,
            duration: item.duration ?? 0,
            source: "youtube",
          });
        }

        return deduped;
      },
      staleTime: 1000 * 60,
    });

  const addToHistoryMutation = useMutation({
    mutationFn: async (track: Track) => {
      if (track.youtubeId) {
        await apiRequest("POST", "/api/history", {
          youtubeId: track.youtubeId,
          title: track.title,
          artist: track.artist,
          thumbnail: track.thumbnail,
          duration: track.duration,
        });
      }
    },
  });

  const handleSearchSelect = (result: SearchResult) => {
    const track: Track = {
      id: result.id,
      youtubeId: result.id,
      title: result.title,
      artist: result.artist,
      thumbnail: result.thumbnailUrl,
      duration: result.duration,
      source: 'youtube',
      // Preserve stream source/instance for consistent stream resolution
      streamSource: result.streamSource,
      streamInstance: result.streamInstance,
    };
    if (result.streamSource) {
      rememberStreamPreference(result.id, result.streamSource, result.streamInstance);
    }
    setCurrentTrack(track);
    setQueue([track]);
    addToHistoryMutation.mutate(track);
  };

  const handleResumeTrack = (track: StreamableTrack) => {
    if (track.streamSource) {
      rememberStreamPreference(track.youtubeId ?? track.id, track.streamSource, track.streamInstance);
    }
    setCurrentTrack(track);
    const queueSource = recentHistory && recentHistory.length > 0 ? recentHistory : trending || [];
    if (queueSource.length) {
      setQueue(queueSource);
    } else {
      setQueue([track]);
    }
    addToHistoryMutation.mutate(track);
  };

  const handleSearchBarClick = () => {
    setIsSearchModalOpen(true);
  };

  const handlePlay = (track: StreamableTrack) => {
    if (track.streamSource) {
      rememberStreamPreference(track.youtubeId ?? track.id, track.streamSource, track.streamInstance);
    }
    setCurrentTrack(track);
    if (trending) {
      setQueue(trending);
    }
    addToHistoryMutation.mutate(track);
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
  };

  return (
    <div className="min-h-screen pb-32">
      {/* Hero Section with Enhanced Search */}
      <div className="relative bg-gradient-to-b from-primary/20 via-background to-background pt-16 pb-24 px-6 overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto z-10">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 text-center bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              {t("home.title")}
            </h1>
            <p className="text-center text-lg text-muted-foreground mb-10">
              {t("home.subtitle")}
            </p>
            <div ref={searchBarRef} className="flex justify-center relative z-[100]">
              <div 
                onClick={handleSearchBarClick}
                className="w-full max-w-2xl cursor-pointer"
              >
                <div className="relative group">
                  {/* Search Icon */}
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-all duration-200 group-hover:scale-110">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Input Field - Read Only */}
                  <div className="pl-11 pr-4 h-14 text-base rounded-full bg-secondary/80 backdrop-blur-sm border-0 shadow-lg transition-all duration-300 hover:bg-secondary/90 hover:shadow-xl flex items-center">
                    <span className="text-muted-foreground">{t("search.placeholder")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trending Section with Animation */}
      <div className="max-w-7xl mx-auto px-6 mt-20 animate-in fade-in duration-700" style={{ animationDelay: '200ms' }}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">
              {t("home.curatedForYou")}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            {t("home.trendingNow")}
          </h2>
          </div>
        </div>

        <div className="space-y-6">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/30 bg-card/40 py-20 shadow-[0_25px_65px_-40px_rgba(15,23,42,0.9)] backdrop-blur">
              <div className="relative mb-5">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
            </div>
            <p className="text-muted-foreground">{t("common.loading")}</p>
          </div>
        ) : trending && trending.length > 0 ? (
            <div
              className="grid gap-3 sm:gap-4 md:gap-6"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
            >
            {trending.map((track, index) => (
              <div
                key={track.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 40}ms` }}
              >
                <TrackCard
                    className="h-full"
                  track={track}
                  onPlay={handlePlay}
                  onAddToQueue={handleAddToQueue}
                />
              </div>
            ))}
          </div>
        ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 py-16 text-center shadow-[0_25px_65px_-40px_rgba(15,23,42,0.9)] backdrop-blur">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">{t("home.noTrendingTracks")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("home.tryAgainLater")}</p>
            </div>
          )}
          </div>
      </div>

      {/* Recently Played */}
      <div className="max-w-7xl mx-auto px-6 mt-16 animate-in fade-in duration-700" style={{ animationDelay: '400ms' }}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">
              {t("home.basedOnHistory")}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            {t("home.continueListening")}
          </h2>
          </div>
        </div>

        <div className="space-y-6">
          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/30 bg-card/40 py-16 text-muted-foreground shadow-[0_25px_65px_-40px_rgba(15,23,42,0.9)] backdrop-blur">
              <Loader2 className="h-10 w-10 animate-spin" />
              <p className="mt-4">{t("common.loading")}</p>
            </div>
          ) : recentHistory && recentHistory.length ? (
            <div
              className="grid gap-3 sm:gap-4 md:gap-6"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
            >
              {recentHistory.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 35}ms` }}
                >
                  <TrackCard
                    className="h-full"
                    track={track}
                    onPlay={handleResumeTrack}
                    onAddToQueue={handleAddToQueue}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 py-14 text-center shadow-[0_25px_65px_-40px_rgba(15,23,42,0.9)] backdrop-blur">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
                <svg className="h-7 w-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <p className="text-muted-foreground mb-1">{t("home.recentlyPlayed")}</p>
              <p className="text-sm text-muted-foreground/80">{t("home.startPlaying")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectResult={handleSearchSelect}
      />
    </div>
  );
}
