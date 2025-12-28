import { uma } from './umaManager';
import { DEFAULT_UMA_CONFIG } from './umaConfig';

interface PipedAudioStream {
  bitrate: number | string;
  codec: string;
  contentLength?: number | string;
  quality: string;
  mimeType: string;
  url: string;
}

interface PipedVideoStream {
  bitrate: number | string;
  codec: string;
  contentLength?: number | string;
  quality: string;
  mimeType: string;
  url: string;
  width?: number;
  height?: number;
  fps?: number;
  itag?: number | string;
}

interface PipedResponse {
  title?: string;
  uploader?: string;
  duration?: number;
  audioStreams?: PipedAudioStream[];
  videoStreams?: PipedVideoStream[];
  hls?: string;
}
export interface ResolvedStream {
  url: string | null;
  manifestUrl?: string | null;
  mimeType?: string;
  audioStreams: PipedAudioStream[];
  videoStreams?: PipedVideoStream[];
  source: 'piped' | 'invidious';
}

function normalizeBitrate(value: number | string | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function preferCodec(a: string, b: string): number {
  const rank = (c: string) => (c.includes('opus') ? 2 : c.includes('aac') ? 1 : 0);
  return rank(a) - rank(b);
}

function buildCache<T>(ttlMs: number) {
  const cache = new Map<string, { expiresAt: number; data: T }>();
  return {
    get(key: string) {
      const entry = cache.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt < Date.now()) {
        cache.delete(key);
        return undefined;
      }
      return entry.data;
    },
    set(key: string, data: T) {
      cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    },
    delete(key: string) {
      cache.delete(key);
    },
  };
}

const streamCache = buildCache<PipedResponse>(1000 * 60 * 10); // 10 minutes
const resolvedStreamCache = buildCache<ResolvedStream>(1000 * 60 * 5);

// Export function to clear cache for a specific video (useful when URL expires)
export function clearResolvedStreamCache(youtubeId: string) {
  resolvedStreamCache.delete(youtubeId);
  // Also clear the underlying stream caches
  streamCache.delete(`piped:${youtubeId}`);
  streamCache.delete(`invidious:${youtubeId}`);
}

async function fetchJsonWithRetry<T>(
  type: 'piped' | 'invidious',
  buildUrl: (base: string) => string,
  options: Parameters<typeof uma.fetchJson>[2],
  cacheOptions: Parameters<typeof uma.fetchJson>[3],
): Promise<T> {
  try {
    return await uma.fetchJson<T>(type, buildUrl, options, cacheOptions);
  } catch (err) {
    console.warn(`[STREAM] ${type} fetch failed (${(err as Error).message}), refreshing config and retrying once.`);
    uma.updateConfig(DEFAULT_UMA_CONFIG); // refresh instances
    return await uma.fetchJson<T>(type, buildUrl, options, cacheOptions);
  }
}

async function fetchFromPiped(youtubeId: string, preferredInstance?: string): Promise<PipedResponse> {
  const cached = streamCache.get(`piped:${youtubeId}`);
  if (cached) return cached;

  const attemptFetch = async (base: string): Promise<PipedResponse> => {
    const resp = await fetch(`${base}/streams/${encodeURIComponent(youtubeId)}`, {
      headers: { Accept: 'application/json,text/plain' },
    });

    if (resp.ok) {
      const contentType = resp.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await resp.json()) as PipedResponse;
      }
      // Some instances return HTML that embeds JSON in a script tag.
      const text = await resp.text();
      const match = text.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
      if (match?.[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          const streams = parsed?.props?.pageProps?.playerData;
          if (streams) return streams as PipedResponse;
        } catch (error) {
          console.warn('[STREAM] Failed to parse embedded JSON from Piped HTML:', error);
        }
      }
      throw new Error(`Unexpected content-type "${contentType}"`);
    }

    throw new Error(`HTTP ${resp.status}`);
  };

  const pipedBases = [...DEFAULT_UMA_CONFIG.piped];
  if (preferredInstance) {
    const normalizedPreferred = preferredInstance.replace(/\/+$/, '');
    const existingIndex = pipedBases.findIndex((base) => base.replace(/\/+$/, '') === normalizedPreferred);
    if (existingIndex >= 0) {
      pipedBases.splice(existingIndex, 1);
    }
    pipedBases.unshift(normalizedPreferred);
  }

  let lastError: unknown;
  for (const base of pipedBases) {
    try {
      const normalized = base.replace(/\/+$/, '');
      const data = await attemptFetch(normalized);

      if (!data || (!data.hls && !Array.isArray(data.audioStreams))) {
        throw new Error('Invalid Piped response');
      }

      streamCache.set(`piped:${youtubeId}`, data);
      return data;
    } catch (error) {
      console.warn(`[STREAM] Piped instance ${base} failed:`, (error as Error)?.message ?? error);
      lastError = error;
      continue;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Piped instances failed');
}

async function fetchFromInvidious(youtubeId: string, preferredInstance?: string): Promise<PipedResponse> {
  const cached = streamCache.get(`invidious:${youtubeId}`);
  if (cached) return cached;

  const instances = [...DEFAULT_UMA_CONFIG.invidious];
  if (preferredInstance) {
    const normalizedPreferred = preferredInstance.replace(/\/+$/, '');
    const existingIndex = instances.findIndex((base) => base.replace(/\/+$/, '') === normalizedPreferred);
    if (existingIndex >= 0) {
      instances.splice(existingIndex, 1);
    }
    instances.unshift(normalizedPreferred);
  }

  let lastError: unknown;
  for (const base of instances) {
    try {
      const data = await fetchJsonWithRetry<any>(
        'invidious',
        () => `${base.replace(/\/+$/, '')}/api/v1/videos/${encodeURIComponent(youtubeId)}`,
        { strictStatus: true },
        {
          cacheKey: `videos:${youtubeId}`,
          ttlMs: 1000 * 60 * 5,
        },
      );

      if (!data || !Array.isArray(data.adaptiveFormats)) {
        throw new Error('Invalid Invidious response');
      }

      const preferredBase = base;
      const candidateBases = [preferredBase, ...DEFAULT_UMA_CONFIG.invidious]
        .filter((value, index, self): value is string => Boolean(value) && self.indexOf(value) === index);

      const parseNumeric = (value: unknown) => {
        const num = typeof value === 'number' ? value : parseInt(String(value ?? '0'), 10);
        return Number.isFinite(num) ? num : undefined;
      };

      const resolveStreamUrl = (format: any): string | undefined => {
        if (typeof format.url === 'string' && format.url.trim().length > 0) {
          return format.url;
        }

        if (typeof format.signatureCipher === 'string') {
          try {
            const params = new URLSearchParams(format.signatureCipher);
            const url = params.get('url');
            if (url) {
              const sig = params.get('sig') ?? params.get('lsig') ?? params.get('s');
              if (sig) {
                const separator = url.includes('?') ? '&' : '?';
                return `${url}${separator}sig=${sig}`;
              }
              return url;
            }
          } catch {
            // fallthrough to latest_version generation
          }
        }

        const itag = format.itag ?? parseNumeric(format.itag);
        if (!itag) return undefined;

        for (const candidateBase of candidateBases) {
          const normalizedBase = candidateBase.replace(/\/+$/, '');
          return `${normalizedBase}/latest_version?id=${encodeURIComponent(youtubeId)}&itag=${encodeURIComponent(
            String(itag),
          )}&download_widget=false&local=true`;
        }

        return undefined;
      };

      const audioStreams = (data.adaptiveFormats as any[])
        .filter((f) => typeof f.type === 'string' && f.type.startsWith('audio'))
        .map((format) => {
          const url = resolveStreamUrl(format);
          return {
            bitrate: parseNumeric(format.bitrate) ?? 0,
            codec: format.encoding || (String(format.type).includes('webm') ? 'opus' : 'aac'),
            contentLength: parseNumeric(format.clen),
            quality: `${Math.max(64, Math.floor((parseNumeric(format.bitrate) ?? 0) / 1024))} kbps`,
            mimeType: format.type,
            url,
          };
        })
        .filter((stream) => Boolean(stream.url));

      // Map itag to quality label
      const getQualityLabel = (itag: number | string | undefined, height: number | undefined): string => {
        if (height) {
          if (height >= 4320) return '4320p (8K)';
          if (height >= 2160) return '2160p (4K)';
          if (height >= 1440) return '1440p (2K)';
          if (height >= 1080) return '1080p';
          if (height >= 720) return '720p';
          if (height >= 480) return '480p';
          if (height >= 360) return '360p';
          if (height >= 240) return '240p';
          if (height >= 144) return '144p';
        }
        // Fallback to itag-based mapping
        const itagNum = typeof itag === 'number' ? itag : parseInt(String(itag || ''), 10);
        const itagMap: Record<number, string> = {
          160: '144p', 133: '240p', 134: '360p', 135: '480p', 136: '720p', 137: '1080p',
          264: '1440p', 266: '2160p', 272: '4320p', 298: '720p60', 299: '1080p60',
          303: '1080p60', 308: '1440p60', 313: '2160p60', 315: '2160p60', 330: '144p60',
          331: '240p60', 332: '360p60', 333: '480p60', 334: '720p60', 335: '1080p60',
          336: '1440p60', 337: '2160p60', 338: '4320p60',
        };
        return itagMap[itagNum] || `${height || 'Unknown'}p`;
      };

      const videoStreams = (data.adaptiveFormats as any[])
        .filter((f) => typeof f.type === 'string' && f.type.startsWith('video'))
        .map((format) => {
          const url = resolveStreamUrl(format);
          const height = parseNumeric(format.height);
          const width = parseNumeric(format.width);
          const itag = parseNumeric(format.itag);
          return {
            bitrate: parseNumeric(format.bitrate) ?? 0,
            codec: format.encoding || (String(format.type).includes('webm') ? 'vp9' : 'avc1'),
            contentLength: parseNumeric(format.clen),
            quality: getQualityLabel(itag, height),
            mimeType: format.type,
            url,
            width,
            height,
            fps: parseNumeric(format.fps),
            itag,
          };
        })
        .filter((stream) => Boolean(stream.url))
        .sort((a, b) => {
          const heightA = a.height || 0;
          const heightB = b.height || 0;
          return heightB - heightA; // Sort by height descending
        });

      const normalized: PipedResponse = {
        audioStreams: audioStreams as PipedAudioStream[],
        videoStreams: videoStreams as PipedVideoStream[],
        hls: typeof data.hlsUrl === 'string' ? data.hlsUrl : undefined,
      };
      streamCache.set(`invidious:${youtubeId}`, normalized);
      return normalized;
    } catch (error) {
      console.warn(`[STREAM] Invidious instance ${base} failed:`, (error as Error)?.message ?? error);
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Invidious instances failed');
}

export async function resolveBestAudioUrl(
  youtubeId: string,
  preferredSource?: 'piped' | 'invidious',
  preferredInstance?: string,
): Promise<ResolvedStream | null> {
  const cached = resolvedStreamCache.get(youtubeId);
  if (cached) return cached;

  let audioStreams: PipedAudioStream[] | undefined;
  let videoStreams: PipedVideoStream[] | undefined;
  let manifestUrl: string | undefined;
  let selectedSource: ResolvedStream['source'] = 'piped';

  const tryPiped = async (instance?: string) => {
    const piped = await fetchFromPiped(youtubeId, instance);
    audioStreams = piped.audioStreams ?? [];
    videoStreams = piped.videoStreams ?? [];
    manifestUrl = piped.hls ?? undefined;
    selectedSource = 'piped';
    try {
      const last = uma.getLastSuccessfulInstance('piped');
      console.log('[STREAM] Resolved via Piped:', last || 'unknown', 'id:', youtubeId, 'audio streams:', audioStreams?.length ?? 0, 'video streams:', videoStreams?.length ?? 0);
    } catch {}
  };

  const tryInvidious = async (instance?: string) => {
    const invidious = await fetchFromInvidious(youtubeId, instance);
    audioStreams = invidious.audioStreams ?? [];
    videoStreams = invidious.videoStreams ?? [];
    manifestUrl = undefined;
    selectedSource = 'invidious';
    try {
      const last = uma.getLastSuccessfulInstance('invidious');
      console.log('[STREAM] Resolved via Invidious:', last || 'unknown', 'id:', youtubeId, 'audio streams:', audioStreams?.length ?? 0, 'video streams:', videoStreams?.length ?? 0);
    } catch {}
  };

  const preferred = preferredSource?.toLowerCase() as 'piped' | 'invidious' | undefined;
  const normalizedInstance = preferredInstance?.replace(/\/+$/, '');
  const pipedHint = preferred === 'piped' ? normalizedInstance : undefined;
  const invidiousHint = preferred === 'invidious' ? normalizedInstance : undefined;

  let pipedError: unknown;
  let invidiousError: unknown;

  if (preferred === 'invidious') {
    try {
      await tryInvidious(invidiousHint);
    } catch (error) {
      invidiousError = error;
      try {
        await tryPiped();
      } catch (fallbackError) {
        pipedError = fallbackError;
      }
    }
  } else {
    try {
      await tryPiped(pipedHint);
    } catch (error) {
      pipedError = error;
      try {
        await tryInvidious(invidiousHint);
      } catch (fallbackError) {
        invidiousError = fallbackError;
      }
    }
  }

  if (!audioStreams || audioStreams.length === 0) return null;

  const sorted = [...audioStreams].sort((a, b) => {
    const codecPref = preferCodec(String(b.codec || ''), String(a.codec || ''));
    if (codecPref !== 0) return codecPref;
    return normalizeBitrate(b.bitrate) - normalizeBitrate(a.bitrate);
  });

  const best = sorted[0];
  if (!best?.url) return null;

  const resolved: ResolvedStream = {
    url: best.url,
    manifestUrl: manifestUrl ?? null,
    mimeType: best.mimeType,
    audioStreams: sorted,
    videoStreams: videoStreams,
    source: selectedSource,
  };

  resolvedStreamCache.set(youtubeId, resolved);
  return resolved;
}
