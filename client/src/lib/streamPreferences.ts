export type StreamPreference = {
  source: 'piped' | 'invidious';
  instance?: string | null;
  updatedAt: number;
};

const STORAGE_KEY = 'stream_preferences_v1';
const MAX_ENTRIES = 200;

const memory = new Map<string, StreamPreference>();
let loaded = false;

function loadFromStorage() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, StreamPreference>;
    Object.entries(parsed).forEach(([id, pref]) => {
      if (pref && typeof pref === 'object' && typeof pref.source === 'string') {
        memory.set(id, pref);
      }
    });
  } catch (error) {
    console.warn('Failed to load stream preferences', error);
  }
}

function saveToStorage() {
  if (typeof window === 'undefined') return;
  const entries = Array.from(memory.entries())
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, MAX_ENTRIES);
  const payload: Record<string, StreamPreference> = {};
  entries.forEach(([id, pref]) => {
    payload[id] = pref;
  });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist stream preferences', error);
  }
}

export function rememberStreamPreference(
  youtubeId: string,
  source: 'piped' | 'invidious' | undefined,
  instance?: string | null,
) {
  if (!youtubeId || !source) return;
  loadFromStorage();
  memory.set(youtubeId, {
    source,
    instance: instance ?? null,
    updatedAt: Date.now(),
  });
  saveToStorage();
}

export function getStreamPreference(youtubeId: string): StreamPreference | undefined {
  if (!youtubeId) return undefined;
  loadFromStorage();
  return memory.get(youtubeId);
}
