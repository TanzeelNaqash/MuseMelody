import { create } from "zustand";

export interface RecentSearchState {
  recent: string[];
  cache: Record<string, any>;

  addSearch: (query: string) => void;
  saveToCache: (query: string, results: any) => void;

  removeSearch: (term: string) => void;
  clearAll: () => void;
}

export const useRecentSearchStore = create<RecentSearchState>((set) => ({
  recent: JSON.parse(localStorage.getItem("recent_searches") || "[]"),
  cache: {},

  addSearch: (query) =>
    set((state) => {
      const cleaned = query.trim();
      if (!cleaned) return state;

      const updated = [
        cleaned,
        ...state.recent.filter((q) => q !== cleaned),
      ].slice(0, 10);

      localStorage.setItem("recent_searches", JSON.stringify(updated));

      return { recent: updated };
    }),

  saveToCache: (query, results) =>
    set((state) => ({
      cache: { ...state.cache, [query.toLowerCase()]: results },
    })),

  removeSearch: (term) =>
    set((state) => {
      const updated = state.recent.filter((item) => item !== term);
      localStorage.setItem("recent_searches", JSON.stringify(updated));
      return { recent: updated };
    }),

    clearAll: () =>
        set(() => {
          localStorage.removeItem("recent_searches");
          return { recent: [], cache: {} }; // ← reset both
        }),
}));
