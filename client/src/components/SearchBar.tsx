import { Search, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
}

interface SearchBarProps {
  onSelectResult: (result: SearchResult) => void;
  className?: string;
}

export function SearchBar({ onSelectResult, className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: suggestions, isLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/youtube/search", query],
    enabled: query.length > 2,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
    onSelectResult(result);
    setQuery("");
    setIsFocused(false);
  };

  return (
    <div ref={searchRef} className={cn("relative w-full max-w-2xl", className)}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search for songs, artists, albums..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className="pl-12 pr-10 h-12 rounded-full bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary"
          data-testid="input-search"
        />
        {query && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Suggestions Dropdown */}
      {isFocused && query.length > 2 && (
        <div className="absolute top-full mt-2 w-full bg-popover border border-popover-border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          ) : suggestions && suggestions.length > 0 ? (
            <div className="py-2">
              {suggestions.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover-elevate active-elevate-2 text-left"
                  data-testid={`search-result-${result.id}`}
                >
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {result.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.artist}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(result.duration / 60)}:{String(result.duration % 60).padStart(2, '0')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
