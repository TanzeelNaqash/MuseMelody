// Minimal adapter to fetch direct audio streams resolved by our backend

import { getStreamPreference } from "@/lib/streamPreferences";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5001";

export interface ResolvedStream {
  url: string;
  proxiedUrl?: string;
  rawUrl?: string;
  manifestUrl?: string | null;
  mimeType?: string;
  origin?: 'piped' | 'invidious';
}

export async function getBestAudioStreamUrl(
  youtubeId: string,
): Promise<ResolvedStream | null> {
  const preference = getStreamPreference(youtubeId);
  const params = new URLSearchParams();
  if (preference?.source) params.set('source', preference.source);
  if (preference?.instance) params.set('instance', preference.instance);
  const query = params.toString();
  const endpoint = `${API_URL}/api/streams/${encodeURIComponent(youtubeId)}/best${query ? `?${query}` : ''}`;

  const res = await fetch(endpoint, {
    credentials: 'include',
  });
  if (!res.ok) {
    // If it's a 403, throw an error with a specific message
    if (res.status === 403) {
      const errorData = await res.json().catch(() => ({}));
      const error = new Error(errorData.error || 'Access denied by video provider');
      (error as any).status = 403;
      throw error;
    }
    return null;
  }
  const data = await res.json();
  if (!data?.url) return null;

  const proxied = data.proxiedUrl ? `${API_URL}${data.proxiedUrl}` : undefined;
  // Always use proxy to avoid CORS issues
  // The proxy will handle 403 errors gracefully
  return {
    url: proxied ?? data.url,
    proxiedUrl: proxied,
    rawUrl: data.url,
    manifestUrl: data.manifestUrl ?? undefined,
    mimeType: data.mimeType ?? undefined,
    origin: data.origin,
  };
}
