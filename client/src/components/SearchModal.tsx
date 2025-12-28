import { Search, X, Play, Clock, TrendingUp, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toProxyImage } from "@/lib/mediaProxy";
import { rememberStreamPreference } from "@/lib/streamPreferences";
import { useRecentSearchStore } from "@/lib/recentSearchStore";

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
  isVideo: boolean;
  streamSource?: 'piped' | 'invidious';
  streamInstance?: string | null;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (result: SearchResult) => void;
}

export function SearchModal({ isOpen, onClose, onSelectResult }: SearchModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { recent, cache, addSearch, saveToCache, removeSearch, clearAll } =
  useRecentSearchStore();

  const { data: suggestions, isLoading, error, refetch, isFetching } =
  useQuery<SearchResult[]>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      const lower = query.toLowerCase();

      // Prevent API hit if query exists in cache
      if (cache[lower]) {
        return cache[lower];
      }

      // Otherwise hit API
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";
      const token = localStorage.getItem("auth_token");

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `${API_URL}/api/search?q=${encodeURIComponent(query)}`,
        { headers, credentials: "include" }
      );

      if (!res.ok) throw new Error("Failed to search YouTube");
      const data = await res.json();

      // Save to cache to avoid API next time
      saveToCache(lower, data);

      return data;
    },
    enabled: query.length > 2,
    staleTime: Infinity, // don't revalidate automatically
    retry: 1,
  });

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        setIsFocused(true);
      }, 100);
    }
  }, [isOpen]);

  // Handle escape key and reset query when modal closes
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      // Reset query when modal closes
      setQuery("");
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleSelect = (result: SearchResult) => {
    addSearch(query);
    onSelectResult(result);
    setQuery("");
    onClose();
  };
  

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      ref={modalRef}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] animate-in fade-in duration-300"
      onClick={handleBackdropClick}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-background/95 backdrop-blur-xl border-b border-border">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              {/* Search Input */}
              <div className="flex-1 relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                
                <Input
                  ref={inputRef}
                  type="search"
                  placeholder={t("search.placeholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className={cn(
                    "pl-12 h-12 text-lg rounded-full bg-secondary/80 backdrop-blur-sm",
                    "border-0 shadow-lg transition-all duration-300",
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:shadow-xl",
                    "hover:bg-secondary/90 placeholder:text-muted-foreground",
                    // Dynamic padding based on whether buttons are shown
                    query ? "pr-20" : "pr-4"
                  )}
                />

                {/* Right side buttons - Clear or Loading */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {isLoading && query.length > 2 && (
                    <div className="h-8 w-8 flex items-center justify-center pointer-events-none">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  
                  {query && !isLoading && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleClear}
                      className="h-8 w-8 hover:bg-accent/50 transition-all duration-200 hover:scale-110 active:scale-95"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}

                  {!isLoading && query && error && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => refetch()}
                      className="h-8 w-8 hover:bg-accent/50 transition-all duration-200 hover:scale-110 active:scale-95"
                    >
                      <Loader2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="h-12 w-12 rounded-full hover:bg-accent/50"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-background/95 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500">
            {query.length === 0 ? (
              /* Empty State - Search Suggestions */
              <div className="p-6 space-y-8">
                {/* Quick Access */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t("search.quickAccess")}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { title: t("search.trendingNow"), icon: "🔥", query: "trending music" },
                      { title: t("search.newReleases"), icon: "✨", query: "new music 2024" },
                      { title: t("search.hipHop"), icon: "🎤", query: "hip hop" },
                      { title: t("search.popMusic"), icon: "🎵", query: "pop music" },
                      { title: t("search.rock"), icon: "🎸", query: "rock music" },
                      { title: t("search.electronic"), icon: "🎧", query: "electronic music" },
                      { title: t("search.classical"), icon: "🎼", query: "classical music" },
                      { title: t("search.jazz"), icon: "🎷", query: "jazz music" },
                    ].map((item, index) => (
                      <button
                        key={index}
                        onClick={() => setQuery(item.query)}
                        className="p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all duration-200 hover:scale-105 text-left group"
                      >
                        <div className="text-2xl mb-2">{item.icon}</div>
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {item.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent Searches */}
                <div className="space-y-4">
                 
                  <div className="space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
      <Clock className="h-5 w-5" />
      {t("search.recentSearches")}
    </h3>

    {recent.length > 0 && (
      <button
        onClick={clearAll}
        className="text-sm text-red-500 hover:underline"
      >
        Clear All
      </button>
    )}
  </div>

  <div className="space-y-2">
    {recent.length === 0 ? (
      <p className="text-muted-foreground text-sm">No recent searches</p>
    ) : (
      recent.map((term, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
        >
          <button
            onClick={() => setQuery(term)}
            className="flex items-center gap-3 flex-1 text-left"
          >
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{term}</span>
          </button>

          {/* delete button */}
          <button
            onClick={() => removeSearch(term)}
            className="text-muted-foreground hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))
    )}
  </div>
</div>

                </div>
              </div>
            ) : query.length <= 2 ? (
              /* Typing State */
              <div className="p-6 text-center">
                <div className="h-16 w-16 rounded-full bg-muted/50 mx-auto mb-4 flex items-center justify-center">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{t("search.keepTyping")}</p>
              </div>
            ) : (
              /* Search Results */
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground">
                    {t("search.results")} <span className="text-primary">"{query}"</span>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isLoading ? t("search.searching") : suggestions ? `${suggestions.length} ${t("search.resultsFound")}` : ""}
                  </p>
                </div>

                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 animate-pulse">
                        <div className="w-16 h-16 bg-muted rounded-xl"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4"></div>
                          <div className="h-3 bg-muted rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : suggestions && suggestions.length > 0 ? (
                  <div className="space-y-3">
                    {suggestions.map((result, index) => (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        className={cn(
                          "w-full p-4 rounded-xl flex items-center gap-4",
                          "text-left transition-all duration-200",
                          "hover:bg-accent/50 hover:scale-[1.01]",
                          "active:scale-[0.99] animate-in fade-in slide-in-from-left-4",
                          "group"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="relative">
                          <img
                            src={toProxyImage(result.thumbnailUrl, { width: 200, height: 200, fit: "cover" })}
                            alt={result.title}
                            className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-lg group-hover:shadow-xl transition-shadow duration-200"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {result.title}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {result.artist}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {Math.floor(result.duration / 60)}:{String(result.duration % 60).padStart(2, '0')}
                            </span>
                            {result.isVideo && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                                VIDEO
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 rounded-full bg-muted/50 mx-auto mb-4 flex items-center justify-center">
                      <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {error
                        ? t("search.errorTitle", { defaultValue: "Something went wrong" })
                        : t("search.noResults")}
                    </h3>
                    <p className="text-muted-foreground">
                      {error
                        ? t("search.errorSubtitle", {
                            defaultValue: "Unable to fetch results. Please try again.",
                          })
                        : t("search.tryDifferent")}
                    </p>
                    {error && (
                      <Button className="mt-4" variant="secondary" onClick={() => refetch()}>
                        {t("search.retry", { defaultValue: "Retry" })}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
